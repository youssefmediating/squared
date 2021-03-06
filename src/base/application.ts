import { AppProcessing, AppSession, FileAsset, UserSettings } from '../../@types/base/application';

import Controller from './controller';
import Extension from './extension';
import ExtensionManager from './extensionmanager';
import Node from './node';
import NodeList from './nodelist';
import Resource from './resource';

const $lib = squared.lib;
const { checkStyleValue, getSpecificity, getStyle, hasComputedStyle, parseSelectorText, validMediaRule } = $lib.css;
const { isTextNode } = $lib.dom;
const { convertCamelCase, isString, objectMap, resolvePath } = $lib.util;
const { STRING, XML } = $lib.regex;
const { getElementCache, setElementCache } = $lib.session;

type PreloadImage = HTMLImageElement | string;

const ASSETS = Resource.ASSETS;
const REGEX_MEDIATEXT = /all|screen/;
const REGEX_DATAURI = new RegExp(`(url\\("(${STRING.DATAURI})"\\)),?\\s*`, 'g');
let REGEX_IMPORTANT!: RegExp;
let REGEX_FONT_FACE!: RegExp;
let REGEX_FONT_FAMILY!: RegExp;
let REGEX_FONT_SRC!: RegExp;
let REGEX_FONT_STYLE!: RegExp;
let REGEX_FONT_WEIGHT!: RegExp;
let REGEX_URL!: RegExp;
let NodeConstructor!: Constructor<Node>;

async function getImageSvgAsync(value: string) {
    const response = await fetch(value, {
        method: 'GET',
        headers: new Headers({ 'Accept': 'application/xhtml+xml, image/svg+xml', 'Content-Type': 'image/svg+xml' })
    });
    return response.text();
}

const parseConditionText = (rule: string, value: string) => new RegExp(`^@${rule}([^{]+)`).exec(value)?.[1].trim() || value;

export default abstract class Application<T extends Node> implements squared.base.Application<T> {
    public controllerHandler: Controller<T>;
    public resourceHandler: Resource<T>;
    public extensionManager: ExtensionManager<T>;
    public initializing = false;
    public closed = false;
    public readonly rootElements = new Set<HTMLElement>();
    public readonly session: AppSession<T> = {
        active: []
    };
    public readonly processing: AppProcessing<T> = {
        cache: new NodeList<T>(),
        excluded: new NodeList<T>(),
        sessionId: ''
    };
    public abstract builtInExtensions: ObjectMap<Extension<T>>;
    public abstract extensions: Extension<T>[];
    public abstract userSettings: UserSettings;

    protected _cascadeAll = false;
    protected _cache!: squared.base.NodeList<T>;

    protected constructor(
        public framework: number,
        nodeConstructor: Constructor<T>,
        ControllerConstructor: Constructor<T>,
        ResourceConstructor: Constructor<T>,
        ExtensionManagerConstructor: Constructor<T>)
    {
        NodeConstructor = nodeConstructor;
        const cache = this.processing.cache;
        this.controllerHandler = <Controller<T>> (new ControllerConstructor(this, cache) as unknown);
        this.resourceHandler = <Resource<T>> (new ResourceConstructor(this, cache) as unknown);
        this.extensionManager = <ExtensionManager<T>> (new ExtensionManagerConstructor(this, cache) as unknown);
        this._cache = cache;
    }

    public abstract insertNode(element: Element, parent?: T): T | undefined;
    public abstract afterCreateCache(element: HTMLElement): void;
    public abstract finalize(): void;

    public copyToDisk(directory: string, callback?: CallbackResult, assets?: FileAsset[]) {
        this.resourceHandler.fileHandler?.copyToDisk(directory, assets, callback);
    }

    public appendToArchive(pathname: string, assets?: FileAsset[]) {
        this.resourceHandler.fileHandler?.appendToArchive(pathname, assets);
    }

    public saveToArchive(filename?: string, assets?: FileAsset[]) {
        this.resourceHandler.fileHandler?.saveToArchive(filename || this.userSettings.outputArchiveName, assets);
    }

    public reset() {
        const processing = this.processing;
        processing.cache.reset();
        processing.excluded.clear();
        processing.sessionId = '';
        this.session.active.length = 0;
        this.controllerHandler.reset();
        for (const ext of this.extensions) {
            ext.subscribers.clear();
        }
        this.closed = false;
    }

    public parseDocument(...elements: any[]): squared.PromiseResult {
        const { controllerHandler: controller, resourceHandler: resource } = this;
        let __THEN: Undefined<() => void>;
        this.rootElements.clear();
        this.initializing = false;
        const sessionId = controller.generateSessionId;
        this.processing.sessionId = sessionId;
        this.session.active.push(sessionId);
        controller.sessionId = sessionId;
        controller.init();
        this.setStyleMap();
        if (elements.length === 0) {
            elements.push(document.body);
        }
        for (const value of elements) {
            let element: HTMLElement | null;
            if (typeof value === 'string') {
                element = document.getElementById(value);
            }
            else if (hasComputedStyle(value)) {
                element = value;
            }
            else {
                continue;
            }
            if (element) {
                this.rootElements.add(element);
            }
        }
        const documentRoot = this.rootElements.values().next().value;
        const preloaded: HTMLImageElement[] = [];
        const resume = () => {
            this.initializing = false;
            for (const image of preloaded) {
                if (image.parentElement) {
                    documentRoot.removeChild(image);
                }
            }
            preloaded.length = 0;
            for (const ext of this.extensions) {
                ext.beforeParseDocument();
            }
            for (const element of this.rootElements) {
                if (this.createCache(element)) {
                    this.afterCreateCache(element);
                }
            }
            for (const ext of this.extensions) {
                ext.afterParseDocument();
            }
            if (typeof __THEN === 'function') {
                __THEN.call(this);
            }
        };
        const preloadImages = this.userSettings.preloadImages;
        const images: PreloadImage[] = [];
        if (preloadImages) {
            for (const element of this.rootElements) {
                element.querySelectorAll('input[type=image]').forEach((image: HTMLInputElement) => {
                    const uri = image.src;
                    if (uri !== '') {
                        ASSETS.images.set(uri, { width: image.width, height: image.height, uri });
                    }
                });
            }
            for (const image of ASSETS.images.values()) {
                const uri = image.uri;
                if (uri) {
                    if (uri.toLowerCase().endsWith('.svg')) {
                        images.push(uri);
                    }
                    else if (image.width === 0 && image.height === 0) {
                        const element = document.createElement('img');
                        element.src = uri;
                        const { naturalWidth, naturalHeight } = element;
                        if (naturalWidth > 0 && naturalHeight > 0) {
                            image.width = naturalWidth;
                            image.height = naturalHeight;
                        }
                        else {
                            documentRoot.appendChild(element);
                            preloaded.push(element);
                        }
                    }
                }
            }
        }
        for (const [uri, data] of ASSETS.rawData.entries()) {
            const mimeType = data.mimeType;
            if (mimeType?.startsWith('image/') && !mimeType.endsWith('svg+xml')) {
                const element = document.createElement('img');
                element.src = 'data:' + mimeType + ';' + (data.base64 ? 'base64,' + data.base64 : data.content);
                const { naturalWidth, naturalHeight } = element;
                if (naturalWidth > 0 && naturalHeight > 0) {
                    data.width = naturalWidth;
                    data.height = naturalHeight;
                    ASSETS.images.set(uri, {
                        width: naturalWidth,
                        height: naturalHeight,
                        uri: data.filename
                    });
                }
                else {
                    document.body.appendChild(element);
                    preloaded.push(element);
                }
            }
        }
        for (const element of this.rootElements) {
            element.querySelectorAll('img').forEach((image: HTMLImageElement) => {
                if (image.src.toLowerCase().endsWith('.svg')) {
                    if (preloadImages) {
                        images.push(image.src);
                    }
                }
                else if (image.complete) {
                    resource.addImage(image);
                }
                else if (preloadImages) {
                    images.push(image);
                }
            });
        }
        if (images.length) {
            this.initializing = true;
            Promise.all(objectMap<PreloadImage, Promise<PreloadImage>>(images, image => {
                return new Promise((resolve, reject) => {
                    if (typeof image === 'string') {
                        resolve(getImageSvgAsync(image));
                    }
                    else {
                        image.addEventListener('load', () => resolve(image));
                        image.addEventListener('error', () => reject(image));
                    }
                });
            }))
            .then((result: PreloadImage[]) => {
                const length = result.length;
                for (let i = 0; i < length; i++) {
                    const value = result[i];
                    if (typeof value === 'string') {
                        const uri = images[i];
                        if (typeof uri === 'string') {
                            resource.addRawData(uri, 'image/svg+xml', 'utf8', value);
                        }
                    }
                    else {
                        resource.addImage(value);
                    }
                }
                resume();
            })
            .catch((error: Event) => {
                const message = (<HTMLImageElement> error.target)?.src || error['message'];
                if (!this.userSettings.showErrorMessages || !isString(message) || confirm('FAIL: ' + message)) {
                    resume();
                }
            });
        }
        else {
            resume();
        }
        const PromiseResult = class {
            public then(resolve: () => void) {
                if (images.length) {
                    __THEN = resolve;
                }
                else {
                    resolve();
                }
            }
        };
        return new PromiseResult();
    }

    public createCache(documentRoot: HTMLElement) {
        const node = this.createRootNode(documentRoot);
        if (node) {
            (node.parent as T).setBounds();
            for (const item of this._cache) {
                item.setBounds();
                item.saveAsInitial();
            }
            this.controllerHandler.sortInitialCache(this._cache);
            return true;
        }
        return false;
    }

    public createNode(element?: Element, append = true, parent?: T, children?: T[]) {
        const node = new NodeConstructor(this.nextId, this.processing.sessionId, element, this.controllerHandler.afterInsertNode) as T;
        if (parent) {
            node.depth = parent.depth + 1;
        }
        if (children) {
            for (const item of children) {
                item.parent = node;
            }
        }
        if (append) {
            this._cache.append(node, children !== undefined);
        }
        return node;
    }

    public toString() {
        return '';
    }

    protected createRootNode(element: HTMLElement) {
        const processing = this.processing;
        const cache = processing.cache;
        cache.clear();
        processing.excluded.clear();
        this._cascadeAll = false;
        const extensions = this.extensionsCascade;
        const node = this.cascadeParentNode(element, 0, extensions.length ? extensions : undefined);
        if (node) {
            const parent = new NodeConstructor(0, processing.sessionId, element.parentElement || document.body, this.controllerHandler.afterInsertNode);
            node.parent = parent;
            node.actualParent = parent;
            node.childIndex = 0;
            node.documentRoot = true;
        }
        processing.node = node;
        cache.afterAppend = undefined;
        return node;
    }

    protected cascadeParentNode(parentElement: HTMLElement, depth: number, extensions?: Extension<T>[]) {
        const node = this.insertNode(parentElement);
        if (node) {
            const { controllerHandler: controller, processing } = this;
            const CACHE = processing.cache;
            node.depth = depth;
            if (depth === 0) {
                CACHE.append(node);
            }
            if (controller.preventNodeCascade(parentElement)) {
                return node;
            }
            const childNodes = parentElement.childNodes;
            const length = childNodes.length;
            const children: T[] = new Array(length);
            const elements: T[] = new Array(parentElement.childElementCount);
            let inlineText = true;
            let j = 0;
            let k = 0;
            for (let i = 0; i < length; i++) {
                const element = <HTMLElement> childNodes[i];
                let child: T | undefined;
                if (element.nodeName.charAt(0) === '#') {
                    if (isTextNode(element)) {
                        child = this.insertNode(element, node);
                    }
                }
                else if (controller.includeElement(element)) {
                    child = this.cascadeParentNode(element, depth + 1, extensions);
                    if (child) {
                        elements[k++] = child;
                        CACHE.append(child);
                        inlineText = false;
                    }
                }
                else {
                    child = this.insertNode(element);
                    if (child) {
                        processing.excluded.append(child);
                        inlineText = false;
                    }
                }
                if (child) {
                    child.parent = node;
                    child.actualParent = node;
                    child.childIndex = j;
                    children[j++] = child;
                }
            }
            children.length = j;
            elements.length = k;
            node.naturalChildren = children;
            node.naturalElements = elements;
            node.inlineText = inlineText;
            if (this.userSettings.createQuerySelectorMap && k > 0) {
                node.queryMap = this.createQueryMap(elements, k);
            }
        }
        return node;
    }

    protected createQueryMap(elements: T[], length: number) {
        const result: T[][] = [elements];
        for (let i = 0; i < length; i++) {
            const childMap = elements[i].queryMap as T[][];
            if (childMap) {
                const lengthA = childMap.length;
                for (let j = 0; j < lengthA; j++) {
                    const k = j + 1;
                    result[k] = result[k]?.concat(childMap[j]) || childMap[j];
                }
            }
        }
        return result;
    }

    protected setStyleMap() {
        let warning = false;
        const applyStyleSheet = (item: CSSStyleSheet) => {
            try {
                const cssRules = item.cssRules;
                if (cssRules) {
                    const lengthA = cssRules.length;
                    for (let j = 0; j < lengthA; j++) {
                        const rule = cssRules[j];
                        switch (rule.type) {
                            case CSSRule.STYLE_RULE:
                            case CSSRule.FONT_FACE_RULE:
                                this.applyStyleRule(<CSSStyleRule> rule);
                                break;
                            case CSSRule.IMPORT_RULE:
                                applyStyleSheet((<CSSImportRule> rule).styleSheet);
                                break;
                            case CSSRule.MEDIA_RULE:
                                if (validMediaRule((<CSSConditionRule> rule).conditionText || parseConditionText('media', rule.cssText))) {
                                    this.applyCSSRuleList((<CSSConditionRule> rule).cssRules);
                                }
                                break;
                            case CSSRule.SUPPORTS_RULE:
                                if (CSS.supports && CSS.supports((<CSSConditionRule> rule).conditionText || parseConditionText('supports', rule.cssText))) {
                                    this.applyCSSRuleList((<CSSConditionRule> rule).cssRules);
                                }
                                break;
                        }
                    }
                }
            }
            catch (error) {
                if (this.userSettings.showErrorMessages && !warning) {
                    alert('CSS cannot be parsed inside <link> tags when loading files directly from your hard drive or from external websites. ' +
                          'Either use a local web server, embed your CSS into a <style> tag, or you can also try using a different browser. ' +
                          'See the README for more detailed instructions.\n\n' +
                          item.href + '\n\n' + error);
                    warning = true;
                }
            }
        };
        const styleSheets = document.styleSheets;
        const length = styleSheets.length;
        for (let i = 0; i < length; i++) {
            const styleSheet = styleSheets[i];
            let mediaText = '';
            try {
                mediaText = styleSheet.media.mediaText;
            }
            catch {
            }
            if (mediaText === '' || REGEX_MEDIATEXT.test(mediaText)) {
                applyStyleSheet(<CSSStyleSheet> styleSheet);
            }
        }
    }

    protected applyCSSRuleList(rules: CSSRuleList) {
        const length = rules.length;
        for (let i = 0; i < length; i++) {
            this.applyStyleRule(<CSSStyleRule> rules[i]);
        }
    }

    protected applyStyleRule(item: CSSStyleRule) {
        const resource = this.resourceHandler;
        const sessionId = this.processing.sessionId;
        const styleSheetHref = item.parentStyleSheet?.href || undefined;
        const cssText = item.cssText;
        switch (item.type) {
            case CSSRule.STYLE_RULE: {
                const cssStyle = item.style;
                const fromRule: string[] = [];
                const important: ObjectMap<boolean> = {};
                const parseImageUrl = (styleMap: StringMap, attr: string) => {
                    const value = styleMap[attr];
                    if (value && value !== 'initial') {
                        let result = value;
                        let match: RegExpExecArray | null;
                        while ((match = REGEX_DATAURI.exec(value)) !== null) {
                            if (match[3] && match[4]) {
                                resource.addRawData(match[2], match[3], match[4], match[5]);
                            }
                            else if (this.userSettings.preloadImages) {
                                const uri = resolvePath(match[5], styleSheetHref);
                                if (uri !== '') {
                                    if (resource.getImage(uri) === undefined) {
                                        ASSETS.images.set(uri, { width: 0, height: 0, uri });
                                    }
                                    result = result.replace(match[1], `url("${uri}")`);
                                }
                            }
                        }
                        styleMap[attr] = result;
                        REGEX_DATAURI.lastIndex = 0;
                    }
                };
                for (const attr of Array.from(cssStyle)) {
                    fromRule.push(convertCamelCase(attr));
                }
                if (cssText.indexOf('!important') !== -1) {
                    if (REGEX_IMPORTANT === undefined) {
                        REGEX_IMPORTANT = /\s*([a-z\-]+):.*?!important;/g;
                    }
                    let match: RegExpExecArray | null;
                    while ((match = REGEX_IMPORTANT.exec(cssText)) !== null) {
                        const attr = convertCamelCase(match[1]);
                        switch (attr) {
                            case 'margin':
                                important.marginTop = true;
                                important.marginRight = true;
                                important.marginBottom = true;
                                important.marginLeft = true;
                                break;
                            case 'padding':
                                important.paddingTop = true;
                                important.paddingRight = true;
                                important.paddingBottom = true;
                                important.paddingLeft = true;
                                break;
                            case 'background':
                                important.backgroundColor = true;
                                important.backgroundImage = true;
                                important.backgroundSize = true;
                                important.backgroundRepeat = true;
                                important.backgroundPositionX = true;
                                important.backgroundPositionY = true;
                                break;
                            case 'backgroundPosition':
                                important.backgroundPositionX = true;
                                important.backgroundPositionY = true;
                                break;
                            case 'border':
                                important.borderTopStyle = true;
                                important.borderRightStyle = true;
                                important.borderBottomStyle = true;
                                important.borderLeftStyle = true;
                                important.borderTopWidth = true;
                                important.borderRightWidth = true;
                                important.borderBottomWidth = true;
                                important.borderLeftWidth = true;
                                important.borderTopColor = true;
                                important.borderRightColor = true;
                                important.borderBottomColor = true;
                                important.borderLeftColor = true;
                                break;
                            case 'borderStyle':
                                important.borderTopStyle = true;
                                important.borderRightStyle = true;
                                important.borderBottomStyle = true;
                                important.borderLeftStyle = true;
                                break;
                            case 'borderWidth':
                                important.borderTopWidth = true;
                                important.borderRightWidth = true;
                                important.borderBottomWidth = true;
                                important.borderLeftWidth = true;
                                break;
                            case 'borderColor':
                                important.borderTopColor = true;
                                important.borderRightColor = true;
                                important.borderBottomColor = true;
                                important.borderLeftColor = true;
                                break;
                            case 'font':
                                important.fontFamily = true;
                                important.fontStyle = true;
                                important.fontSize = true;
                                important.fontWeight = true;
                                important.lineHeight = true;
                                break;
                        }
                        important[attr] = true;
                    }
                    REGEX_IMPORTANT.lastIndex = 0;
                }
                for (const selectorText of parseSelectorText(item.selectorText)) {
                    const specificity = getSpecificity(selectorText);
                    const [selector, target] = selectorText.split('::');
                    const targetElt = target ? '::' + target : '';
                    document.querySelectorAll(selector || '*').forEach((element: HTMLElement) => {
                        const style = getStyle(element, targetElt);
                        const styleMap: StringMap = {};
                        for (const attr of fromRule) {
                            const value = checkStyleValue(element, attr, cssStyle[attr], style);
                            if (value) {
                                styleMap[attr] = value;
                            }
                        }
                        parseImageUrl(styleMap, 'backgroundImage');
                        parseImageUrl(styleMap, 'listStyleImage');
                        parseImageUrl(styleMap, 'content');
                        const attrStyle = 'styleMap' + targetElt;
                        const attrSpecificity = 'styleSpecificity' + targetElt;
                        const styleData: StringMap = getElementCache(element, attrStyle, sessionId);
                        if (styleData) {
                            const specificityData: ObjectMap<number> = getElementCache(element, attrSpecificity, sessionId) || {};
                            for (const attr in styleMap) {
                                const revisedSpecificity = specificity + (important[attr] ? 1000 : 0);
                                if (specificityData[attr] === undefined || revisedSpecificity >= specificityData[attr]) {
                                    const value = styleMap[attr];
                                    if (value === 'initial' && cssStyle.background && attr.startsWith('background')) {
                                        continue;
                                    }
                                    specificityData[attr] = revisedSpecificity;
                                    styleData[attr] = value;
                                }
                            }
                        }
                        else {
                            const specificityData: ObjectMap<number> = {};
                            for (const attr in styleMap) {
                                specificityData[attr] = specificity + (important[attr] ? 1000 : 0);
                            }
                            setElementCache(element, 'style' + targetElt, '0', style);
                            setElementCache(element, 'sessionId', '0', sessionId);
                            setElementCache(element, attrStyle, sessionId, styleMap);
                            setElementCache(element, attrSpecificity, sessionId, specificityData);
                        }
                    });
                }
                break;
            }
            case CSSRule.FONT_FACE_RULE: {
                if (REGEX_FONT_FACE === undefined) {
                    REGEX_FONT_FACE = /\s*@font-face\s*{([^}]+)}\s*/;
                    REGEX_FONT_FAMILY = /\s*font-family:[^\w]*([^'";]+)/;
                    REGEX_FONT_SRC = /\s*src:\s*([^;]+);/;
                    REGEX_FONT_STYLE = /\s*font-style:\s*(\w+)\s*;/;
                    REGEX_FONT_WEIGHT = /\s*font-weight:\s*(\d+)\s*;/;
                    REGEX_URL = /\s*(url|local)\((?:['"]([^'")]+)['"]|([^)]+))\)\s*format\(['"]?(\w+)['"]?\)\s*/;
                }
                const match = REGEX_FONT_FACE.exec(cssText);
                if (match) {
                    const attr = match[1];
                    const familyMatch = REGEX_FONT_FAMILY.exec(attr);
                    const srcMatch = REGEX_FONT_SRC.exec(attr);
                    if (familyMatch && srcMatch) {
                        const styleMatch = REGEX_FONT_STYLE.exec(attr);
                        const weightMatch = REGEX_FONT_WEIGHT.exec(attr);
                        const fontFamily = familyMatch[1].trim();
                        const fontStyle = styleMatch?.[1].toLowerCase() || 'normal';
                        const fontWeight = weightMatch ? parseInt(weightMatch[1]) : 400;
                        for (const value of srcMatch[1].split(XML.SEPARATOR)) {
                            const urlMatch = REGEX_URL.exec(value);
                            if (urlMatch) {
                                let srcUrl: string | undefined;
                                let srcLocal: string | undefined;
                                const url = (urlMatch[2] || urlMatch[3]).trim();
                                if (urlMatch[1] === 'url') {
                                    srcUrl = resolvePath(url, styleSheetHref);
                                }
                                else {
                                    srcLocal = url;
                                }
                                resource.addFont({
                                    fontFamily,
                                    fontWeight,
                                    fontStyle,
                                    srcUrl,
                                    srcLocal,
                                    srcFormat: urlMatch[4].toLowerCase().trim()
                                });
                            }
                        }
                    }
                }
                break;
            }
        }
    }

    get extensionsCascade() {
        return <Extension<T>[]> [];
    }

    get nextId() {
        return this._cache.nextId;
    }

    get length() {
        return 0;
    }
}