const { USER_AGENT, isUserAgent } = squared.lib.client;

function hasUnsupportedAccess(element: SVGElement) {
    if (element.tagName === 'svg') {
        if (isUserAgent(USER_AGENT.FIREFOX)) {
            return element.parentElement instanceof HTMLElement;
        }
        else if (isUserAgent(USER_AGENT.SAFARI)) {
            return !(element.parentElement instanceof HTMLElement);
        }
    }
    return false;
}

export default <T extends Constructor<squared.svg.SvgBaseVal>>(Base: T) => {
    return class extends Base implements squared.svg.SvgViewRect {
        private _x?: number;
        private _y?: number;
        private _width?: number;
        private _height?: number;

        public setRect() {
            const parent = this.parent;
            let { x, y, width, height } = this;
            if (parent) {
                x = parent.refitX(x);
                y = parent.refitY(y);
                width = parent.refitSize(width);
                height = parent.refitSize(height);
            }
            this.setBaseValue('x', x);
            this.setBaseValue('y', y);
            this.setBaseValue('width', width);
            this.setBaseValue('height', height);
        }

        private _getElement() {
            const element = this.element;
            switch (element.tagName) {
                case 'svg':
                case 'use':
                case 'image':
                    return <SVGSVGElement> element;
                default:
                    return null;
            }
        }

        set x(value) {
            this._x = value;
        }
        get x() {
            return this._x ?? (this._getElement()?.x.baseVal.value || 0);
        }

        set y(value) {
            this._y = value;
        }
        get y() {
            return this._y ?? (this._getElement()?.y.baseVal.value || 0);
        }

        set width(value) {
            this._width = value;
        }
        get width() {
            const result = this._width;
            if (result !== undefined) {
                return result;
            }
            else {
                const element = this._getElement();
                if (element) {
                    return hasUnsupportedAccess(element) ? element.getBoundingClientRect().width : element.width.baseVal.value;
                }
                return 0;
            }
        }

        set height(value) {
            this._height = value;
        }
        get height() {
            const result = this._height;
            if (result !== undefined) {
                return result;
            }
            else {
                const element = this._getElement();
                if (element) {
                    return hasUnsupportedAccess(element) ? element.getBoundingClientRect().height : element.height.baseVal.value;
                }
                return 0;
            }
        }
    };
};