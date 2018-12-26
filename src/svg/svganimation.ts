import $util = squared.lib.util;

export default class SvgAnimation implements squared.svg.SvgAnimation {
    public static convertClockTime(value: string) {
        let s = 0;
        let ms = 0;
        if (/\d+ms$/.test(value)) {
            ms = parseInt(value);
        }
        else if (/\d+s$/.test(value)) {
            s = parseInt(value);
        }
        else if (/\d+min$/.test(value)) {
            s = parseInt(value) * 60;
        }
        else if (/\d+(.\d+)?h$/.test(value)) {
            s = parseFloat(value) * 60 * 60;
        }
        else {
            const match = /^(?:(\d?\d):)?(?:(\d?\d):)?(\d?\d)\.?(\d?\d?\d)?$/.exec(value);
            if (match) {
                if (match[1]) {
                    s += parseInt(match[1]) * 60 * 60;
                }
                if (match[2]) {
                    s += parseInt(match[2]) * 60;
                }
                if (match[3]) {
                    s += parseInt(match[3]);
                }
                if (match[4]) {
                    ms = parseInt(match[4]) * (match[4].length < 3 ? Math.pow(10, 3 - match[4].length) : 1);
                }
            }
        }
        return s * 1000 + ms;
    }

    public attributeName = '';
    public to = '';
    public begin: number[] = [0];
    public duration: number;

    constructor(
        public element: SVGAnimationElement,
        public parentElement: SVGGraphicsElement)
    {
        this.setAttribute('attributeName');
        this.setAttribute('to');
        const begin = this.getAttribute('begin');
        const dur = this.getAttribute('dur');
        if (begin === 'indefinite') {
            this.begin.length = 0;
        }
        else if (begin !== '') {
            this.begin = begin.split(';').map(value => SvgAnimation.convertClockTime(value)).sort((a, b) => a < b ? -1 : 1);
        }
        if (dur === ''  || dur === 'indefinite') {
            this.duration = -1;
        }
        else {
            this.duration = SvgAnimation.convertClockTime(dur);
        }
    }

    public setAttribute(attr: string, equality?: string) {
        const value = this.getAttribute(attr);
        if (value) {
            if (equality !== undefined) {
                this[attr + $util.capitalize(equality)] = value === equality;
            }
            else {
                this[attr] = value;
            }
        }
    }

    public getAttribute(attr: string) {
        const item = this.element.attributes.getNamedItem(attr);
        return item ? item.value.trim() : '';
    }
}