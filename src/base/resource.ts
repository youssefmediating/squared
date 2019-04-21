import { ResourceAssetMap, ResourceStoredMap, UserSettings, ViewData } from './@types/application';

import Application from './application';
import File from './file';
import Node from './node';
import NodeList from './nodelist';

import { NODE_RESOURCE } from './lib/enumeration';

const $color = squared.lib.color;
const $css = squared.lib.css;
const $math = squared.lib.math;
const $session = squared.lib.session;
const $util = squared.lib.util;
const $xml = squared.lib.xml;

const REGEXP_LINEBREAK = /\s*<br[^>]*>\s*/g;
const STRING_COLORSTOP = `(rgba?\\(\\d+, \\d+, \\d+(?:, [\\d.]+)?\\)|#[a-zA-Z\\d]{3,}|[a-z]+)\\s*(${$util.STRING_PATTERN.LENGTH_PERCENTAGE}|${$util.STRING_PATTERN.ANGLE}|(?:${$util.STRING_PATTERN.CALC}(?=,)|${$util.STRING_PATTERN.CALC}))?,?\\s*`;
const REGEXP_BACKGROUNDIMAGE = new RegExp(`(?:initial|url\\("?.+?"?\\)|(repeating)?-?(linear|radial|conic)-gradient\\(((?:to [a-z ]+|(?:from )?-?[\\d.]+(?:deg|rad|turn|grad)|(?:circle|ellipse)?\\s*(?:closest-side|closest-corner|farthest-side|farthest-corner)?)?(?:\\s*at [\\w %]+)?),?\\s*((?:${STRING_COLORSTOP})+)\\))`, 'g');

function removeExcluded(node: Node, element: Element, attr: string) {
    let value: string = element[attr];
    for (const item of node.actualChildren) {
        if ((item.excluded || item.pseudoElement || item.dataset.target) && $util.isString(item[attr])) {
            value = value.replace(item[attr], '');
        }
    }
    if (attr === 'innerHTML') {
        value = value.replace($xml.REGEXP_ESCAPE.ENTITY, (match, capture) => String.fromCharCode(parseInt(capture)));
    }
    return value;
}

function parseColorStops(node: Node, gradient: Gradient, value: string, opacity: string) {
    const radial = <RadialGradient> gradient;
    const repeating = !!radial.repeating;
    const extent = repeating && gradient.type === 'radial' ? radial.radiusExtent / radial.radius : 1;
    const result: ColorStop[] = [];
    const pattern = new RegExp(STRING_COLORSTOP, 'g');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(value)) !== null) {
        const color = $color.parseColor(match[1], opacity, true);
        if (color) {
            const item: ColorStop = { color, offset: -1 };
            if (gradient.type === 'conic') {
                if (match[3] && match[4]) {
                    item.offset = $util.convertAngle(match[3], match[4]) / 360;
                }
            }
            else if (match[2]) {
                if ($util.isPercent(match[2])) {
                    item.offset = parseFloat(match[2]) / 100;
                }
                else if (repeating) {
                    const horizontal = radial.horizontal;
                    const dimension = gradient.type === 'radial' ? radial.radius : (<Dimension> gradient.dimension)[horizontal ? 'width' : 'height'];
                    if ($util.isLength(match[2])) {
                        item.offset = node.parseUnit(match[2], horizontal, false) / dimension;
                    }
                    else if ($util.isCalc(match[2])) {
                        item.offset = $util.calculate(match[6], dimension, node.fontSize) / dimension;
                    }
                }
                if (repeating && item.offset !== -1) {
                    item.offset *= extent;
                }
            }
            if (result.length === 0) {
                if (item.offset === -1) {
                    item.offset = 0;
                }
                else if (item.offset > 0) {
                    result.push({ color, offset: 0 });
                }
            }
            result.push(item);
        }
    }
    const lastStop = result[result.length - 1];
    if (lastStop.offset === -1) {
        lastStop.offset = 1;
    }
    let percent = 0;
    for (let i = 0; i < result.length; i++) {
        const item = result[i];
        if (item.offset === -1) {
            if (i === 0) {
                item.offset = 0;
            }
            else {
                for (let j = i + 1, k = 2; j < result.length - 1; j++, k++) {
                    if (result[j].offset !== -1) {
                        item.offset = (percent + result[j].offset) / k;
                        break;
                    }
                }
                if (item.offset === -1) {
                    item.offset = percent + lastStop.offset / (result.length - 1);
                }
            }
        }
        percent = item.offset;
    }
    if (repeating) {
        if (percent < 100) {
            const original = result.slice(0);
            complete: {
                let basePercent = percent;
                while (percent < 100) {
                    for (let i = 0; i < original.length; i++) {
                        percent = Math.min(basePercent + original[i].offset, 1);
                        result.push({ ...original[i], offset: percent });
                        if (percent === 1) {
                            break complete;
                        }
                    }
                    basePercent = percent;
                }
            }
        }
    }
    else if (percent < 1) {
        result.push({ ...result[result.length - 1], offset: 1 });
    }
    return result;
}

function parseAngle(value: string) {
    if (value) {
        let degree = $util.parseAngle(value.trim());
        if (degree < 0) {
            degree += 360;
        }
        return degree;
    }
    return 0;
}

function replaceWhiteSpace(parent: Node, node: Node, element: Element, value: string): [string, boolean] {
    value = value.replace($xml.REGEXP_ESCAPE.U00A0, '&#160;');
    switch (node.css('whiteSpace')) {
        case 'nowrap':
            value = value.replace(/\n/g, ' ');
            break;
        case 'pre':
        case 'pre-wrap':
            if (!parent.layoutVertical) {
                value = value.replace(/^\s*?\n/, '');
            }
            value = value
                .replace(/\n/g, '\\n')
                .replace(/\s/g, '&#160;');
            break;
        case 'pre-line':
            value = value
                .replace(/\n/g, '\\n')
                .replace(/\s+/g, ' ');
            break;
        default:
            if (element.previousSibling && $session.causesLineBreak(<Element> element.previousSibling, node.sessionId)) {
                value = value.replace($util.REGEXP_COMPILED.LEADINGSPACE, '');
            }
            if (element.nextSibling && $session.causesLineBreak(<Element> element.nextSibling, node.sessionId)) {
                value = value.replace($util.REGEXP_COMPILED.TRAILINGSPACE, '');
            }
            return [value, false];
    }
    return [value, true];
}

function getBackgroundSize(node: Node, index: number, value?: string) {
    if (value) {
        const sizes = value.split($util.REGEXP_COMPILED.SEPARATOR);
        return Resource.getBackgroundSize(node, sizes[index % sizes.length]);
    }
    return undefined;
}

function applyTextTransform(type: string, value: string) {
    value = value.replace($xml.REGEXP_ESCAPE.AMP, '&amp;');
    if (type === 'none' || type === 'initial') {
        return value;
    }
    const words = value.split($util.REGEXP_COMPILED.BREAKWORD);
    switch (type) {
        case 'uppercase':
            for (const word of words) {
                if (!$util.REGEXP_COMPILED.ENTITY.test(word)) {
                    value = value.replace(word, word.toUpperCase());
                }
            }
            break;
        case 'lowercase':
            for (const word of words) {
                if (!$util.REGEXP_COMPILED.ENTITY.test(word)) {
                    value = value.replace(word, word.toLowerCase());
                }
            }
            break;
        case 'capitalize':
            for (const word of words) {
                value = value.replace(word, $util.capitalize(word));
            }
            break;
    }
    return value;
}

const getGradientPosition = (value: string) => value ? /(.+?)?\s*at (.+?)$/.exec(value) : null;

export default abstract class Resource<T extends Node> implements squared.base.Resource<T> {
    public static KEY_NAME = 'squared.resource';

    public static ASSETS: ResourceAssetMap = {
        ids: new Map(),
        images: new Map()
    };

    public static STORED: ResourceStoredMap = {
        strings: new Map(),
        arrays: new Map(),
        fonts: new Map(),
        colors: new Map(),
        images: new Map()
    };

    public static generateId(section: string, name: string, start = 1) {
        const prefix = name;
        let i = start;
        if (start === 1) {
            name += `_${i.toString()}`;
        }
        const previous = this.ASSETS.ids.get(section) || [];
        do {
            if (!previous.includes(name)) {
                previous.push(name);
                break;
            }
            else {
                name = `${prefix}_${(++i).toString()}`;
            }
        }
        while (true);
        this.ASSETS.ids.set(section, previous);
        return name;
    }

    public static insertStoredAsset(asset: string, name: string, value: any) {
        const stored: Map<string, any> = Resource.STORED[asset];
        if (stored && $util.hasValue(value)) {
            let result = this.getStoredName(asset, value);
            if (result === '') {
                if ($util.isNumber(name)) {
                    name = `__${name}`;
                }
                let i = 0;
                do {
                    result = name;
                    if (i > 0) {
                        result += `_${i}`;
                    }
                    if (!stored.has(result)) {
                        stored.set(result, value);
                    }
                    i++;
                }
                while (stored.has(result) && stored.get(result) !== value);
            }
            return result;
        }
        return '';
    }

    public static getOptionArray(element: HTMLSelectElement) {
        const stringArray: string[] = [];
        const textTransform = $css.getStyle(element).getPropertyValue('text-transform');
        let numberArray: string[] | undefined = [];
        let i = -1;
        while (++i < element.children.length) {
            const item = <HTMLOptionElement> element.children[i];
            const value = item.text.trim();
            if (value !== '') {
                if (numberArray && stringArray.length === 0 && $util.isNumber(value)) {
                    numberArray.push(value);
                }
                else {
                    if (numberArray && numberArray.length) {
                        i = -1;
                        numberArray = undefined;
                        continue;
                    }
                    if (value !== '') {
                        stringArray.push(applyTextTransform(textTransform, value));
                    }
                }
            }
        }
        return [stringArray.length ? stringArray : undefined, numberArray && numberArray.length ? numberArray : undefined];
    }

    public static isBackgroundVisible(object: BoxStyle | undefined) {
        return object !== undefined && (object.backgroundImage !== undefined || object.borderTop !== undefined || object.borderRight !== undefined || object.borderBottom !== undefined || object.borderLeft !== undefined);
    }

    public static getBackgroundSize(node: Node, value: string): Dimension | undefined {
        let width = 0;
        let height = 0;
        switch (value) {
            case '':
            case 'cover':
            case 'contain':
            case '100% 100%':
            case 'auto':
            case 'auto auto':
            case 'initial':
                return undefined;
            default:
                const dimensions = value.split(' ');
                if (dimensions.length === 1) {
                    dimensions[1] = dimensions[0];
                }
                for (let i = 0; i < dimensions.length; i++) {
                    if (dimensions[i] === 'auto') {
                        dimensions[i] = '100%';
                    }
                    if (i === 0) {
                        width = node.parseUnit(dimensions[i], true, false);
                    }
                    else {
                        height = node.parseUnit(dimensions[i], false, false);
                    }
                }
                break;
        }
        return width > 0 && height > 0 ? { width: Math.round(width), height: Math.round(height) } : undefined;
    }

    public static isInheritedStyle(node: Node, attr: string) {
        if (node.styleElement) {
            const actualParent = node.actualParent;
            if (actualParent && !node.cssInitial(attr)) {
                return node.style[attr] === actualParent.style[attr];
            }
        }
        return false;
    }

    public static causesLineBreak(node: Node) {
        return node.lineBreak || node.excluded && node.blockStatic;
    }

    public static hasLineBreak(node: Node, lineBreak = false, trim = false) {
        if (node.actualChildren.length) {
            return node.actualChildren.some(item => item.lineBreak);
        }
        else if (!lineBreak && node.element && node.element.textContent) {
            let value = node.element.textContent;
            if (trim) {
                value = value.trim();
            }
            if (/\n/.test(value)) {
                if (node.plainText && $css.isParentStyle(node.element, 'whiteSpace', 'pre', 'pre-wrap')) {
                    return true;
                }
                return node.css('whiteSpace').startsWith('pre');
            }
        }
        return false;
    }

    private static getStoredName(asset: string, value: any): string {
        if (Resource.STORED[asset]) {
            for (const [name, data] of Resource.STORED[asset].entries()) {
                if ($util.isEqual(value, data)) {
                    return name;
                }
            }
        }
        return '';
    }

    public fileHandler?: File<T>;

    protected constructor(
        public application: Application<T>,
        public cache: NodeList<T>)
    {
    }

    public abstract get userSettings(): UserSettings;

    public finalize(data: ViewData) {}

    public reset() {
        for (const name in Resource.ASSETS) {
            Resource.ASSETS[name] = new Map();
        }
        for (const name in Resource.STORED) {
            Resource.STORED[name] = new Map();
        }
        if (this.fileHandler) {
            this.fileHandler.reset();
        }
    }

    public setBoxStyle() {
        for (const node of this.cache) {
            if (node.visible && node.styleElement) {
                const boxStyle: BoxStyle = {
                    backgroundColor: '',
                    backgroundSize: '',
                    backgroundRepeat: '',
                    backgroundPositionX: '',
                    backgroundPositionY: '',
                    backgroundImage: undefined,
                    borderRadius: undefined,
                    backgroundClip: undefined
                };
                if (!node.css('border').startsWith('0px none')) {
                    boxStyle.borderTop = undefined;
                    boxStyle.borderRight = undefined;
                    boxStyle.borderBottom = undefined;
                    boxStyle.borderLeft = undefined;
                }
                for (const attr in boxStyle) {
                    const value = node.css(attr);
                    switch (attr) {
                        case 'backgroundColor': {
                            if (!node.has('backgroundColor') && (value === node.cssAscend('backgroundColor', false, true) || node.documentParent.visible && Resource.isInheritedStyle(node, 'backgroundColor'))) {
                                continue;
                            }
                            const color = $color.parseColor(value, node.css('opacity'));
                            if (color) {
                                boxStyle.backgroundColor = color.valueAsRGBA;
                            }
                            break;
                        }
                        case 'backgroundSize':
                        case 'backgroundRepeat':
                        case 'backgroundPositionX':
                        case 'backgroundPositionY':
                            boxStyle[attr] = value;
                            break;
                        case 'backgroundImage':
                            if (value !== 'none' && node.hasResource(NODE_RESOURCE.IMAGE_SOURCE)) {
                                const images: (string | Gradient)[] = [];
                                const opacity = node.css('opacity');
                                let match: RegExpExecArray | null;
                                let i = 0;
                                while ((match = REGEXP_BACKGROUNDIMAGE.exec(value)) !== null) {
                                    const [complete, repeating, type, direction, colorStop] = match;
                                    if (complete === 'initial' || complete.startsWith('url')) {
                                        images.push(complete);
                                    }
                                    else {
                                        const dimension = getBackgroundSize(node, i, boxStyle.backgroundSize) || node.actualDimension;
                                        let gradient: Gradient | undefined;
                                        switch (type) {
                                            case 'conic': {
                                                const position = getGradientPosition(direction);
                                                const conic = <ConicGradient> {
                                                    type,
                                                    dimension,
                                                    angle: parseAngle(direction)
                                                };
                                                conic.center = $css.getBackgroundPosition(position && position[2] || 'center', dimension, node.fontSize);
                                                conic.colorStops = parseColorStops(node, conic, colorStop, opacity);
                                                gradient = conic;
                                                break;
                                            }
                                            case 'radial': {
                                                const position = getGradientPosition(direction);
                                                const radial = <RadialGradient> {
                                                    type,
                                                    repeating: repeating === 'repeating',
                                                    horizontal: node.actualWidth <= node.actualHeight,
                                                    dimension,
                                                    shape: position && position[1] && position[1].startsWith('circle') ? 'circle' : 'ellipse'
                                                };
                                                radial.center = $css.getBackgroundPosition(position && position[2] || 'center', dimension, node.fontSize);
                                                radial.closestCorner = Number.POSITIVE_INFINITY;
                                                radial.farthestCorner = Number.NEGATIVE_INFINITY;
                                                for (const corner of [[0, 0], [dimension.width, 0], [dimension.width, dimension.height], [0, dimension.height]]) {
                                                    const length = Math.round(Math.sqrt(Math.pow(Math.abs(corner[0] - radial.center.left), 2) + Math.pow(Math.abs(corner[1] - radial.center.top), 2)));
                                                    if (length < radial.closestCorner) {
                                                        radial.closestCorner = length;
                                                    }
                                                    if (length > radial.farthestCorner) {
                                                        radial.farthestCorner = length;
                                                    }
                                                }
                                                radial.closestSide = radial.center.top;
                                                radial.farthestSide = radial.center.top;
                                                for (const side of [dimension.width - radial.center.left, dimension.height - radial.center.top, radial.center.left]) {
                                                    if (side < radial.closestSide) {
                                                        radial.closestSide = side;
                                                    }
                                                    if (side > radial.farthestSide) {
                                                        radial.farthestSide = side;
                                                    }
                                                }
                                                radial.radius = radial.farthestCorner;
                                                const extent = position && position[1] ? position[1].split(' ').pop() : '';
                                                switch (extent) {
                                                    case 'closest-corner':
                                                    case 'closest-side':
                                                    case 'farthest-side':
                                                        const length = radial[$util.convertCamelCase(extent)];
                                                        if (repeating) {
                                                            radial.radiusExtent = length;
                                                        }
                                                        else {
                                                            radial.radius = length;
                                                        }
                                                        break;
                                                    default:
                                                        radial.radiusExtent = radial.farthestCorner;
                                                        break;
                                                }
                                                radial.colorStops = parseColorStops(node, radial, colorStop, opacity);
                                                gradient = radial;
                                                break;
                                            }
                                            default: {
                                                let angle = 180;
                                                switch (direction) {
                                                    case 'to top':
                                                        angle = 0;
                                                        break;
                                                    case 'to right top':
                                                        angle = 45;
                                                        break;
                                                    case 'to right':
                                                        angle = 90;
                                                        break;
                                                    case 'to right bottom':
                                                        angle = 135;
                                                        break;
                                                    case 'to bottom':
                                                        break;
                                                    case 'to left bottom':
                                                        angle = 225;
                                                        break;
                                                    case 'to left':
                                                        angle = 270;
                                                        break;
                                                    case 'to left top':
                                                        angle = 315;
                                                        break;
                                                    default:
                                                        if (direction) {
                                                            angle = parseAngle(direction);
                                                        }
                                                        break;
                                                }
                                                const linear = <LinearGradient> {
                                                    type,
                                                    repeating: repeating === 'repeating',
                                                    horizontal: angle >= 45 && angle <= 135 || angle >= 225 && angle <= 315,
                                                    dimension,
                                                    angle
                                                };
                                                linear.colorStops = parseColorStops(node, linear, colorStop, opacity);
                                                const width = dimension.width;
                                                const height = dimension.height;
                                                let x = $math.truncateFraction($math.offsetAngleX(angle, width));
                                                let y = $math.truncateFraction($math.offsetAngleY(angle, height));
                                                if (x !== width && y !== height && !$math.isEqual(Math.abs(x), Math.abs(y))) {
                                                    let oppositeAngle: number;
                                                    if (angle <= 90) {
                                                        oppositeAngle = $math.offsetAngle({ x: 0, y: height }, { x: width, y: 0 });
                                                    }
                                                    else if (angle <= 180) {
                                                        oppositeAngle = $math.offsetAngle({ x: 0, y: 0 }, { x: width, y: height });
                                                    }
                                                    else if (angle <= 270) {
                                                        oppositeAngle = $math.offsetAngle({ x: 0, y: 0 }, { x: -width, y: height });
                                                    }
                                                    else {
                                                        oppositeAngle = $math.offsetAngle({ x: 0, y: height }, { x: -width, y: 0 });
                                                    }
                                                    let a = Math.abs(oppositeAngle - angle);
                                                    let b = 90 - a;
                                                    const lenX = $math.triangulateASA(a, b, Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2)));
                                                    x = $math.truncateFraction($math.offsetAngleX(angle, lenX[1]));
                                                    a = 90;
                                                    b = 90 - angle;
                                                    const lenY = $math.triangulateASA(a, b, x);
                                                    y = $math.truncateFraction($math.offsetAngleY(angle, lenY[0]));
                                                }
                                                linear.angleExtent = { x, y };
                                                gradient = linear;
                                                break;
                                            }
                                        }
                                        images.push(gradient);
                                    }
                                    i++;
                                }
                                if (i > 0) {
                                    boxStyle.backgroundImage = images;
                                }
                            }
                            break;
                        case 'backgroundClip':
                            switch (value) {
                                case 'content-box':
                                    boxStyle.backgroundClip = {
                                        top: node.borderTopWidth + node.paddingTop,
                                        right: node.borderRightWidth + node.paddingRight,
                                        bottom: node.borderBottomWidth + node.paddingBottom,
                                        left: node.borderLeftWidth + node.paddingLeft
                                    };
                                    break;
                                case 'padding-box':
                                    boxStyle.backgroundClip = {
                                        top: node.borderTopWidth,
                                        right: node.borderRightWidth,
                                        bottom: node.borderBottomWidth,
                                        left: node.borderLeftWidth
                                    };
                                    break;
                            }
                            break;
                        case 'borderTop':
                        case 'borderRight':
                        case 'borderBottom':
                        case 'borderLeft': {
                            const style = node.css(`${attr}Style`) || 'none';
                            const width = node.convertPX(node.css(`${attr}Width`), (attr === 'borderLeft' || attr === 'borderRight'), false) || '0px';
                            let color = node.css(`${attr}Color`) || 'initial';
                            switch (color.toLowerCase()) {
                                case 'initial':
                                    color = 'rgb(0, 0, 0)';
                                    break;
                                case 'inherit':
                                case 'currentcolor':
                                    color = $css.getInheritedStyle(node.element, `${attr}Color`);
                                    break;
                            }
                            if (style !== 'none' && width !== '0px') {
                                const borderColor = $color.parseColor(color, node.css('opacity'), true);
                                if (borderColor) {
                                    boxStyle[attr] = <BorderAttribute> {
                                        width,
                                        style,
                                        color: borderColor.valueAsRGBA
                                    };
                                }
                            }
                            break;
                        }
                        case 'borderRadius':
                            if (value !== '0px') {
                                const horizontal = node.actualWidth >= node.actualHeight;
                                const [A, B] = node.css('borderTopLeftRadius').split(' ');
                                const [C, D] = node.css('borderTopRightRadius').split(' ');
                                const [E, F] = node.css('borderBottomRightRadius').split(' ');
                                const [G, H] = node.css('borderBottomLeftRadius').split(' ');
                                let borderRadius: string[];
                                if (!B && !D && !F && !H) {
                                    borderRadius = [A, C, E, G];
                                }
                                else {
                                    borderRadius = [A, B || A, C, D || C, E, F || E, G, H || G];
                                }
                                if (borderRadius.every(radius => radius === borderRadius[0])) {
                                    if (borderRadius[0] === '0px' || borderRadius[0] === '') {
                                        continue;
                                    }
                                    borderRadius.length = 1;
                                }
                                for (let i = 0; i < borderRadius.length; i++) {
                                    borderRadius[i] = node.convertPX(borderRadius[i], horizontal, false);
                                }
                                boxStyle.borderRadius = borderRadius;
                            }
                            break;
                    }
                }
                if (boxStyle.borderTop && boxStyle.borderRight && boxStyle.borderBottom && boxStyle.borderLeft) {
                    let valid = true;
                    for (const attr in boxStyle.borderTop) {
                        const value = boxStyle.borderTop[attr];
                        if (value !== boxStyle.borderRight[attr] || value !== boxStyle.borderBottom[attr] || value !== boxStyle.borderLeft[attr]) {
                            valid = false;
                            break;
                        }
                    }
                    if (valid) {
                        boxStyle.border = boxStyle.borderTop;
                    }
                }
                node.data(Resource.KEY_NAME, 'boxStyle', boxStyle);
            }
        }
    }

    public setFontStyle() {
        for (const node of this.cache) {
            if (!(node.element === null ||
                node.renderChildren.length ||
                node.imageElement ||
                node.svgElement ||
                node.tagName === 'HR' ||
                node.inlineText && !node.preserveWhiteSpace && node.element.innerHTML.trim() === '' && !Resource.isBackgroundVisible(node.data(Resource.KEY_NAME, 'boxStyle'))))
            {
                const opacity = node.css('opacity');
                const color = $color.parseColor(node.css('color'), opacity);
                let fontFamily = node.css('fontFamily').trim();
                let fontSize = node.css('fontSize');
                let fontWeight = node.css('fontWeight');
                if ($util.isUserAgent($util.USER_AGENT.EDGE) && !node.has('fontFamily')) {
                    switch (node.tagName) {
                        case 'TT':
                        case 'CODE':
                        case 'KBD':
                        case 'SAMP':
                            fontFamily = 'monospace';
                            break;
                    }
                }
                if ($util.convertInt(fontSize) === 0) {
                    switch (fontSize) {
                        case 'xx-small':
                            fontSize = '8px';
                            break;
                        case 'x-small':
                            fontSize = '10px';
                            break;
                        case 'small':
                            fontSize = '13px';
                            break;
                        case 'medium':
                            fontSize = '16px';
                            break;
                        case 'large':
                            fontSize = '18px';
                            break;
                        case 'x-large':
                            fontSize = '24px';
                            break;
                        case 'xx-large':
                            fontSize = '32px';
                            break;
                    }
                }
                if (!$util.isNumber(fontWeight)) {
                    switch (fontWeight) {
                        case 'lighter':
                            fontWeight = '200';
                            break;
                        case 'bold':
                            fontWeight = '700';
                            break;
                        case 'bolder':
                            fontWeight = '900';
                            break;
                        default:
                            fontWeight = '400';
                            break;
                    }
                }
                const result: FontAttribute = {
                    fontFamily,
                    fontStyle: node.css('fontStyle'),
                    fontSize,
                    fontWeight,
                    color: color ? color.valueAsRGBA : ''
                };
                node.data(Resource.KEY_NAME, 'fontStyle', result);
            }
        }
    }

    public setValueString() {
        for (const node of this.cache) {
            if (node.visible && !node.svgElement) {
                const element = <HTMLInputElement> node.element;
                const renderParent = node.renderParent;
                if (element && renderParent) {
                    let name = '';
                    let value = '';
                    let trimming = false;
                    let inlined = false;
                    const transform = node.css('textTransform');
                    switch (element.tagName) {
                        case 'INPUT':
                            value = element.value;
                            switch (element.type) {
                                case 'radio':
                                case 'checkbox':
                                    if (node.companion && !node.companion.visible) {
                                        value = node.companion.textContent;
                                    }
                                    break;
                                case 'submit':
                                    if (value === '' && !node.visibleStyle.backgroundImage) {
                                        value = 'Submit';
                                    }
                                    break;
                                case 'time':
                                    if (value === '') {
                                        value = '--:-- --';
                                    }
                                    break;
                                case 'date':
                                case 'datetime-local':
                                    if (value === '') {
                                        switch ((new Intl.DateTimeFormat()).resolvedOptions().locale) {
                                            case 'en-US':
                                                value = 'mm/dd/yyyy';
                                                break;
                                            default:
                                                value = 'dd/mm/yyyy';
                                                break;
                                        }
                                        if (element.type === 'datetime-local') {
                                            value += ' --:-- --';
                                        }
                                    }
                                    break;
                                case 'week':
                                    if (value === '') {
                                        value = 'Week: --, ----';
                                    }
                                    break;
                                case 'month':
                                    if (value === '') {
                                        value = '--------- ----';
                                    }
                                    break;
                                case 'url':
                                case 'email':
                                case 'search':
                                case 'number':
                                case 'tel':
                                    if (value === '') {
                                        value = element.placeholder;
                                    }
                                    break;
                                case 'file':
                                    value = $util.isUserAgent($util.USER_AGENT.FIREFOX) ? 'Browse...' : 'Choose File';
                                    break;
                            }
                            break;
                        case 'TEXTAREA':
                            value = element.value;
                            break;
                        case 'BUTTON':
                            value = applyTextTransform(transform, element.innerText);
                            break;
                        case 'IFRAME':
                            value = element.src;
                            break;
                        default:
                            if (node.plainText) {
                                name = node.textContent.trim();
                                [value] = replaceWhiteSpace(renderParent, node, element, applyTextTransform(transform, node.textContent));
                                inlined = true;
                                trimming = true;
                            }
                            else if (node.inlineText) {
                                name = node.textContent.trim();
                                if (element.tagName === 'CODE') {
                                    value = removeExcluded(node, element, 'innerHTML');
                                }
                                else if (Resource.hasLineBreak(node, true)) {
                                    value = applyTextTransform(transform, removeExcluded(node, element, 'innerHTML')).replace(REGEXP_LINEBREAK, '\\n').replace($util.REGEXP_COMPILED.TAGNAME_G, '');
                                }
                                else {
                                    value = applyTextTransform(transform, removeExcluded(node, element, 'textContent'));
                                }
                                [value, inlined] = replaceWhiteSpace(renderParent, node, element, value);
                                trimming = true;
                            }
                            else if (Resource.isBackgroundVisible(node.data(Resource.KEY_NAME, 'boxStyle')) && element.innerText.trim() === '') {
                                value = applyTextTransform(transform, element.innerText);
                            }
                            break;
                    }
                    if (value !== '') {
                        if (trimming) {
                            const previousSibling = node.previousSiblings().pop();
                            let previousSpaceEnd = false;
                            if (value.length > 1) {
                                if (previousSibling === undefined || previousSibling.multiline || previousSibling.lineBreak || previousSibling.plainText && $util.REGEXP_COMPILED.TRAILINGSPACE.test(previousSibling.textContent)) {
                                    value = value.replace($util.REGEXP_COMPILED.LEADINGSPACE, '');
                                }
                                else if (previousSibling.element) {
                                    previousSpaceEnd = $util.REGEXP_COMPILED.TRAILINGSPACE.test((<HTMLElement> previousSibling.element).innerHTML || (<HTMLElement> previousSibling.element).innerText || previousSibling.textContent);
                                }
                            }
                            if (inlined) {
                                const original = value;
                                value = value.trim();
                                if (previousSibling && !previousSibling.block && !previousSibling.lineBreak && !previousSpaceEnd && $util.REGEXP_COMPILED.LEADINGSPACE.test(original)) {
                                    value = '&#160;' + value;
                                }
                                if (!node.lineBreakTrailing && $util.REGEXP_COMPILED.TRAILINGSPACE.test(original)) {
                                    value += '&#160;';
                                }
                            }
                            else if (value.trim() !== '') {
                                value = value.replace($util.REGEXP_COMPILED.LEADINGSPACE, previousSibling && (
                                    previousSibling.block ||
                                    previousSibling.lineBreak ||
                                    previousSpaceEnd && previousSibling.htmlElement && previousSibling.textContent.length > 1 ||
                                    node.multiline && Resource.hasLineBreak(node)) ? '' : '&#160;'
                                );
                                value = value.replace($util.REGEXP_COMPILED.TRAILINGSPACE, node.display === 'table-cell' || node.lineBreakTrailing || node.blockStatic ? '' : '&#160;');
                            }
                            else if (!node.inlineText) {
                                continue;
                            }
                        }
                        if (value !== '') {
                            node.data(Resource.KEY_NAME, 'valueString', { name, value });
                        }
                    }
                }
            }
        }
    }

    get stored() {
        return Resource.STORED;
    }
}