import { ResourceStoredMapAndroid, StyleAttribute } from '../../@types/android/application';

import { RESERVED_JAVA } from './lib/constant';

const $lib = squared.lib;
const { findColorShade, parseColor } = $lib.color;
const { getSrcSet } = $lib.css;
const { CHAR, COMPONENT, CSS, XML } = $lib.regex;
const { fromLastIndexOf, isNumber, isPlainObject, isString, resolvePath, trimString } = $lib.util;

const STORED = <ResourceStoredMapAndroid> squared.base.ResourceUI.STORED;
const REGEX_NONWORD = /[^\w+]/g;
let CACHE_IMAGE: StringMap = {};
let IMAGE_FORMAT!: string[];

function formatObject(obj: {}, numberAlias = false) {
    if (obj) {
        for (const attr in obj) {
            if (isPlainObject(obj[attr])) {
                formatObject(obj, numberAlias);
            }
            else {
                let value: string = obj[attr]?.toString();
                if (value) {
                    switch (attr) {
                        case 'text':
                            if (!value.startsWith('@string/')) {
                                value = Resource.addString(value, '', numberAlias);
                                if (value !== '') {
                                    obj[attr] = '@string/' + value;
                                }
                            }
                            continue;
                        case 'src':
                        case 'srcCompat':
                            if (COMPONENT.PROTOCOL.test(value)) {
                                value = Resource.addImage({ mdpi: value });
                                if (value !== '') {
                                    obj[attr] = '@drawable/' + value;
                                }
                            }
                            continue;
                    }
                    const color = parseColor(value);
                    if (color) {
                        const colorName = Resource.addColor(color);
                        if (colorName !== '') {
                            obj[attr] = '@color/' + colorName;
                        }
                    }
                }
            }
        }
    }
}

export default class Resource<T extends android.base.View> extends squared.base.ResourceUI<T> implements android.base.Resource<T> {
    public static formatOptions(options: ExternalData, numberAlias = false) {
        for (const namespace in options) {
            const obj: ExternalData = options[namespace];
            if (isPlainObject(obj)) {
                formatObject(obj, numberAlias);
            }
        }
        return options;
    }

    public static formatName(value: string) {
        if (CHAR.LEADINGNUMBER.test(value)) {
            value = '__' + value;
        }
        return value.replace(REGEX_NONWORD, '_');
    }

    public static addTheme(...values: StyleAttribute[]) {
        const themes = STORED.themes;
        for (const theme of values) {
            const { items, output } = theme;
            let path = 'res/values';
            let file = 'themes.xml';
            if (output) {
                if (isString(output.path)) {
                    path = output.path.trim();
                }
                if (isString(output.file)) {
                    file = output.file.trim();
                }
            }
            const filename = trimString(path, '/') + '/' + trimString(file, '/');
            const storedFile = themes.get(filename) || new Map<string, StyleAttribute>();
            let name = theme.name;
            let appTheme = '';
            if (name === '' || name.charAt(0) === '.') {
                found: {
                    for (const data of themes.values()) {
                        for (const style of data.values()) {
                            if (style.name) {
                                appTheme = style.name;
                                break found;
                            }
                        }
                    }
                }
                if (appTheme === '') {
                    continue;
                }
            }
            else {
                appTheme = name;
            }
            name = appTheme + (name.charAt(0) === '.' ? name : '');
            theme.name = name;
            Resource.formatOptions(items);
            const storedTheme = <StyleAttribute> storedFile.get(name);
            if (storedTheme) {
                const storedItems = storedTheme.items;
                for (const attr in items) {
                    storedItems[attr] = items[attr];
                }
            }
            else {
                storedFile.set(name, theme);
            }
            themes.set(filename, storedFile);
        }
    }

    public static addString(value: string, name = '', numberAlias = false) {
        if (value !== '') {
            if (name === '') {
                name = value.trim();
            }
            const numeric = isNumber(value);
            if (!numeric || numberAlias) {
                const strings = STORED.strings;
                for (const [resourceName, resourceValue] of strings.entries()) {
                    if (resourceValue === value) {
                        return resourceName;
                    }
                }
                const partial = trimString(name.replace(XML.NONWORD_G, '_'), '_').split(/_+/);
                if (partial.length > 1) {
                    if (partial.length > 4) {
                        partial.length = 4;
                    }
                    name = partial.join('_');
                }
                else {
                    name = partial[0];
                }
                name = name.toLowerCase();
                if (numeric || CHAR.LEADINGNUMBER.test(name) || RESERVED_JAVA.includes(name)) {
                    name = '__' + name;
                }
                else if (name === '') {
                    name = '__symbol' + Math.ceil(Math.random() * 100000);
                }
                if (strings.has(name)) {
                    name = Resource.generateId('string', name);
                }
                strings.set(name, value);
            }
            return name;
        }
        return '';
    }

    public static addImage(images: StringMap, prefix = '') {
        const mdpi = images.mdpi;
        if (mdpi) {
            if (CACHE_IMAGE[mdpi] && Object.keys(images).length === 1) {
                return CACHE_IMAGE[mdpi];
            }
            const src = fromLastIndexOf(mdpi, '/');
            const format = fromLastIndexOf(src, '.').toLowerCase();
            if (IMAGE_FORMAT.includes(format) && format !== 'svg') {
                CACHE_IMAGE[mdpi] = Resource.insertStoredAsset('images', Resource.formatName(prefix + src.substring(0, src.length - format.length - 1)), images);
                return CACHE_IMAGE[mdpi];
            }
        }
        return '';
    }

    public static addColor(color: ColorData | string | undefined, transparency = false) {
        if (typeof color === 'string') {
            color = parseColor(color, 1, transparency);
        }
        if (color && (!color.transparent || transparency)) {
            const keyName = color.opacity < 1 ? color.valueAsARGB : color.value;
            let colorName = STORED.colors.get(keyName);
            if (colorName) {
                return colorName;
            }
            const shade = findColorShade(color.value);
            if (shade) {
                colorName = keyName === shade.value ? shade.key : Resource.generateId('color', shade.key);
                STORED.colors.set(keyName, colorName);
                return colorName;
            }
        }
        return '';
    }

    constructor(
        public application: android.base.Application<T>,
        public cache: squared.base.NodeList<T>)
    {
        super();
        STORED.styles = new Map();
        STORED.themes = new Map();
        STORED.dimens = new Map();
        STORED.drawables = new Map();
        STORED.animators = new Map();
        this.controllerSettings = application.controllerHandler.localSettings;
        IMAGE_FORMAT = this.controllerSettings.supported.imageFormat as string[];
    }

    public reset() {
        super.reset();
        CACHE_IMAGE = {};
    }

    public addImageSrc(element: HTMLImageElement | string, prefix = '', imageSet?: ImageSrcSet[]) {
        const result: StringMap = {};
        if (typeof element === 'string') {
            const match = CSS.URL.exec(element);
            if (match) {
                if (match[1].startsWith('data:image')) {
                    result.mdpi = match[1];
                }
                else {
                    return Resource.addImage({ mdpi: resolvePath(match[1]) }, prefix);
                }
            }
        }
        else {
            if (element.srcset) {
                if (imageSet === undefined) {
                    imageSet = getSrcSet(element, IMAGE_FORMAT);
                }
                for (const image of imageSet) {
                    const pixelRatio = image.pixelRatio;
                    if (pixelRatio > 0) {
                        const src = image.src;
                        if (pixelRatio < 1) {
                            result.ldpi = src;
                        }
                        else if (pixelRatio === 1) {
                            if (result.mdpi === undefined || image.actualWidth) {
                                result.mdpi = src;
                            }
                        }
                        else if (pixelRatio <= 1.5) {
                            result.hdpi = src;
                        }
                        else if (pixelRatio <= 2) {
                            result.xhdpi = src;
                        }
                        else if (pixelRatio <= 3) {
                            result.xxhdpi = src;
                        }
                        else {
                            result.xxxhdpi = src;
                        }
                    }
                }
            }
            if (result.mdpi === undefined) {
                result.mdpi = element.src;
            }
        }
        const mdpi = result.mdpi;
        if (mdpi) {
            const resource = this.application.resourceHandler;
            const rawData = resource.getRawData(mdpi);
            if (rawData?.base64) {
                if (rawData.filename.toLowerCase().endsWith('.svg')) {
                    return '';
                }
                const filename = prefix + rawData.filename;
                resource.writeRawImage(filename, rawData.base64);
                return filename.substring(0, filename.lastIndexOf('.'));
            }
        }
        return Resource.addImage(result, prefix);
    }

    get userSettings() {
        return this.application.userSettings;
    }
}