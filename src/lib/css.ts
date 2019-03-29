import { parseColor } from './color';
import { getElementAsNode, getElementCache, setElementCache } from './dom';
import { REGEXP_COMPILED, STRING_PATTERN, USER_AGENT, calculate, capitalize, convertAlpha, convertRoman, convertCamelCase, convertPX, convertLength, convertPercent, isLength, isUserAgent, resolvePath } from './util';

type Node = squared.base.Node;

export const BOX_POSITION = ['top', 'right', 'bottom', 'left'];
export const BOX_MARGIN = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'];
export const BOX_PADDING = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];

export function getKeyframeRules(): CSSRuleData {
    const keyFrameRule = /((?:\d+%\s*,?\s*)+|from|to)\s*{\s*(.+?)\s*}/;
    const result = new Map<string, ObjectMap<StringMap>>();
    violation: {
        for (let i = 0; i < document.styleSheets.length; i++) {
            const styleSheet = <CSSStyleSheet> document.styleSheets[i];
            if (styleSheet.cssRules) {
                for (let j = 0; j < styleSheet.cssRules.length; j++) {
                    try {
                        const item = <CSSKeyframesRule> styleSheet.cssRules[j];
                        if (item.type === 7) {
                            const map: ObjectMap<StringMap> = {};
                            for (let k = 0; k < item.cssRules.length; k++) {
                                const match = keyFrameRule.exec(item.cssRules[k].cssText);
                                if (match) {
                                    for (let percent of (item.cssRules[k]['keyText'] || match[1].trim()).split(REGEXP_COMPILED.SEPARATOR)) {
                                        percent = percent.trim();
                                        switch (percent) {
                                            case 'from':
                                                percent = '0%';
                                                break;
                                            case 'to':
                                                percent = '100%';
                                                break;
                                        }
                                        map[percent] = {};
                                        for (const property of match[2].split(';')) {
                                            const [name, value] = property.split(':');
                                            if (value) {
                                                map[percent][name.trim()] = value.trim();
                                            }
                                        }
                                    }
                                }
                            }
                            result.set(item.name, map);
                        }
                    }
                    catch {
                        break violation;
                    }
                }
            }
        }
    }
    return result;
}

export function hasComputedStyle(element: Element | null): element is HTMLElement {
    if (element) {
        return typeof element['style'] === 'object' && element['style'] !== null && element['style']['display'] !== null;
    }
    return false;
}

export function checkStyleValue(element: Element, attr: string, value: string, style?: CSSStyleDeclaration, fontSize?: number) {
    if (value === 'inherit') {
        value = getInheritedStyle(element, attr);
    }
    if (value && value !== 'initial') {
        const computed = style ? style[attr] : '';
        if (value !== computed) {
            if (computed !== '') {
                switch (attr) {
                    case 'backgroundColor':
                    case 'borderTopColor':
                    case 'borderRightColor':
                    case 'borderBottomColor':
                    case 'borderLeftColor':
                    case 'color':
                    case 'fontSize':
                    case 'fontWeight':
                        return computed;
                }
                if (REGEXP_COMPILED.CUSTOMPROPERTY.test(value)) {
                    return computed;
                }
            }
            switch (attr) {
                case 'width':
                case 'height':
                case 'minWidth':
                case 'maxWidth':
                case 'minHeight':
                case 'maxHeight':
                case 'lineHeight':
                case 'verticalAlign':
                case 'textIndent':
                case 'letterSpacing':
                case 'columnGap':
                case 'top':
                case 'right':
                case 'bottom':
                case 'left':
                case 'marginTop':
                case 'marginRight':
                case 'marginBottom':
                case 'marginLeft':
                case 'paddingTop':
                case 'paddingRight':
                case 'paddingBottom':
                case 'paddingLeft':
                    return isLength(value) ? convertPX(value, fontSize) : value;
            }
        }
        return value;
    }
    return '';
}

export function getDataSet(element: HTMLElement | null, prefix: string) {
    const result: StringMap = {};
    if (element) {
        prefix = convertCamelCase(prefix, '.');
        for (const attr in element.dataset) {
            if (attr.startsWith(prefix)) {
                result[capitalize(attr.substring(prefix.length), false)] = element.dataset[attr] as string;
            }
        }
    }
    return result;
}

export function getStyle(element: Element | null, target?: string, cache = true): CSSStyleDeclaration {
    if (element) {
        const attr = 'style' + (target ? '::' + target : '');
        if (cache) {
            const style = getElementCache(element, attr);
            if (style) {
                return style;
            }
            else if (element.nodeName === '#text') {
                const node = getElementAsNode<Node>(element);
                if (node && node.plainText) {
                    return node.unsafe('styleMap');
                }
            }
        }
        if (hasComputedStyle(element)) {
            const style = getComputedStyle(element, target);
            setElementCache(element, attr, style);
            return style;
        }
        return <CSSStyleDeclaration> {};
    }
    return <CSSStyleDeclaration> { display: 'none' };
}

export function getFontSize(element: Element | null) {
    return parseInt(getStyle(element).fontSize || '16px');
}

export function isParentStyle(element: Element | null, attr: string, ...styles: string[]) {
    if (element) {
        return element.nodeName.charAt(0) !== '#' && styles.includes(getStyle(element)[attr]) || element.parentElement && styles.includes(getStyle(element.parentElement)[attr]);
    }
    return false;
}

export function getInheritedStyle(element: Element | null, attr: string, exclude?: RegExp, ...tagNames: string[]) {
    let value = '';
    if (element) {
        let current = element.parentElement;
        while (current && !tagNames.includes(current.tagName)) {
            value = getStyle(current)[attr];
            if (value === 'inherit' || exclude && exclude.test(value)) {
                value = '';
            }
            if (value !== '' || current === document.body) {
                break;
            }
            current = current.parentElement;
        }
    }
    return value;
}

export function isInheritedStyle(element: Element | null, attr: string) {
    if (hasComputedStyle(element) && element.parentElement) {
        const node = getElementAsNode<Node>(element);
        if (node && !node.cssInitial(attr)) {
            return getStyle(element)[attr] === getStyle(element.parentElement)[attr];
        }
    }
    return false;
}

export function getInlineStyle(element: Element, attr: string) {
    let value = hasComputedStyle(element) ? element.style[attr] : '';
    if (!value) {
        const styleMap: StringMap = getElementCache(element, 'styleMap');
        if (styleMap) {
            value = styleMap[attr];
        }
    }
    return value || '';
}

export function getAttribute(element: Element, attr: string, computed = false) {
    const node = getElementAsNode<Node>(element);
    const name = convertCamelCase(attr);
    return node && node.cssInitial(name) || getInlineStyle(element, name) || getNamedItem(element, attr) || computed && getStyle(element)[name] as string || '';
}

export function getParentAttribute(element: Element | null, attr: string) {
    let current: HTMLElement | Element | null = element;
    let value = '';
    while (current) {
        value = getAttribute(current, attr);
        if (value !== '' && value !== 'inherit') {
            break;
        }
        current = current.parentElement;
    }
    return value;
}

export function parseVar(element: HTMLElement | SVGElement, value: string) {
    const style = getStyle(element);
    let match: RegExpMatchArray | null;
    while ((match = new RegExp(`${STRING_PATTERN.VAR}`).exec(value)) !== null) {
        let propertyValue = style.getPropertyValue(match[1]).trim();
        if (match[2] && (isLength(match[2], true) && !isLength(propertyValue, true) || parseColor(match[2]) !== undefined && parseColor(propertyValue) === undefined)) {
            propertyValue = match[2];
        }
        if (propertyValue !== '') {
            value = value.replace(match[0], propertyValue);
        }
        else {
            return undefined;
        }
    }
    return value;
}

export function calculateVar(element: HTMLElement | SVGElement, value: string, attr?: string, dimension?: number) {
    const result = parseVar(element, value);
    if (result) {
        if (attr && !dimension) {
            const vertical = /(top|bottom|height)/.test(attr.toLowerCase());
            if (element instanceof SVGElement) {
                const rect = element.getBoundingClientRect();
                dimension = vertical || attr.length <= 2 && attr.indexOf('y') !== -1 ? rect.height : rect.width;
            }
            else {
                const rect = (element.parentElement || element).getBoundingClientRect();
                dimension = vertical ? rect.height : rect.width;
            }
        }
        return calculate(result, dimension, getFontSize(element));
    }
    return undefined;
}

export function getNamedItem(element: Element | null, attr: string) {
    if (element) {
        const item = element.attributes.getNamedItem(attr);
        if (item) {
            return item.value.trim();
        }
    }
    return '';
}

export function getBackgroundPosition(value: string, dimension: Dimension, fontSize?: number) {
    const result: RectPosition = {
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        topAsPercent: 0,
        leftAsPercent: 0,
        rightAsPercent: 0,
        bottomAsPercent: 0,
        horizontal: 'left',
        vertical: 'top'
    };
    const orientation = value === 'center' ? ['center', 'center'] : value.split(' ');
    if (orientation.length === 2) {
        for (let i = 0; i < orientation.length; i++) {
            const position = orientation[i];
            let direction: string;
            let offsetParent: number;
            if (i === 0) {
                direction = 'left';
                offsetParent = dimension.width;
                result.horizontal = position;
            }
            else {
                direction = 'top';
                offsetParent = dimension.height;
                result.vertical = position;
            }
            const directionAsPercent = `${direction}AsPercent`;
            switch (position) {
                case 'start':
                    result.horizontal = 'left';
                    break;
                case 'end':
                    result.horizontal = 'right';
                case 'right':
                case 'bottom':
                    result[direction] = offsetParent;
                    result[directionAsPercent] = 1;
                    break;
                case 'center':
                    result[direction] = offsetParent / 2;
                    result[directionAsPercent] = 0.5;
                    break;
                default:
                    result[direction] = convertLength(position, offsetParent, fontSize);
                    result[directionAsPercent] = convertPercent(position, offsetParent, fontSize);
                    break;
            }
        }
    }
    else if (orientation.length === 4) {
        for (let i = 0; i < orientation.length; i++) {
            const position = orientation[i];
            switch (i) {
                case 0:
                    result.horizontal = position;
                    break;
                case 1: {
                    const location = convertLength(position, dimension.width, fontSize);
                    const locationAsPercent = convertPercent(position, dimension.width, fontSize);
                    switch (result.horizontal) {
                        case 'end:':
                            result.horizontal = 'right';
                        case 'right':
                            result.right = location;
                            result.left = dimension.width - location;
                            result.rightAsPercent = locationAsPercent;
                            result.leftAsPercent = 1 - locationAsPercent;
                            break;
                        case 'start':
                            result.horizontal = 'left';
                        default:
                            result.left = location;
                            result.leftAsPercent = locationAsPercent;
                            break;
                    }
                    break;
                }
                case 2:
                    result.vertical = position;
                    break;
                case 3: {
                    const location = convertLength(position, dimension.height, fontSize);
                    const locationAsPercent = convertPercent(position, dimension.height, fontSize);
                    if (result.vertical === 'bottom') {
                        result.bottom = location;
                        result.top = dimension.height - location;
                        result.bottomAsPercent = locationAsPercent;
                        result.topAsPercent = 1 - locationAsPercent;
                    }
                    else {
                        result.top = location;
                        result.topAsPercent = locationAsPercent;
                    }
                    break;
                }
            }
        }
    }
    return result;
}

export function convertListStyle(name: string, value: number, valueAsDefault = false) {
    switch (name) {
        case 'decimal':
            return value.toString();
        case 'decimal-leading-zero':
            return (value < 9 ? '0' : '') + value.toString();
        case 'upper-alpha':
        case 'upper-latin':
            if (value >= 1) {
                return convertAlpha(value - 1);
            }
            break;
        case 'lower-alpha':
        case 'lower-latin':
            if (value >= 1) {
                return convertAlpha(value - 1).toLowerCase();
            }
            break;
        case 'upper-roman':
            return convertRoman(value);
        case 'lower-roman':
            return convertRoman(value).toLowerCase();
    }
    return valueAsDefault ? value.toString() : '';
}

export function resolveURL(value: string) {
    const match = value.match(REGEXP_COMPILED.URL);
    return match ? resolvePath(match[1]) : '';
}

export function insertStyleSheetRule(value: string, index = 0) {
    const style = document.createElement('style');
    if (isUserAgent(USER_AGENT.SAFARI)) {
        style.appendChild(document.createTextNode(''));
    }
    document.head.appendChild(style);
    const sheet = style.sheet;
    if (sheet && typeof sheet['insertRule'] === 'function') {
        try {
            (sheet as any).insertRule(value, index);
        }
        catch {
            return null;
        }
    }
    return style;
}