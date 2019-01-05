import { SvgImageBaseVal, SvgPathBaseVal, SvgTransform, SvgViewBox } from '../svg/@types/object';

declare global {
    namespace squared.svg {
        interface SvgElement extends SvgBase {
            transform: SvgTransform[];
            transformed: boolean;
            readonly animatable: boolean;
            build(exclusions?: number[], savePath?: boolean): string;
            filterTransform(exclusions?: number[]): SvgTransform[];
        }

        interface SvgShape extends SvgElement {
            path?: SvgPath;
            setPath(value: SvgPath): void;
            synchronize(useKeyTime?: boolean): void;
        }

        interface SvgTransformable {
            baseVal: SvgImageBaseVal;
            rotateOrigin?: PointR;
        }

        interface SvgImage extends SvgElement, SvgViewBox, SvgTransformable {
            href: string;
        }

        interface SvgUse extends SvgShape, Point {}

        interface SvgPath extends SvgElement, SvgTransformable {
            opacity: number;
            d: string;
            color: string;
            fillRule: string;
            fill: string;
            fillOpacity: string;
            stroke: string;
            strokeWidth: string;
            strokeOpacity: string;
            strokeLinecap: string;
            strokeLinejoin: string;
            strokeMiterlimit: string;
            clipPath: string;
            clipRule: string;
            baseVal: SvgPathBaseVal;
            setColor(attr: string): void;
            setOpacity(attr: string): void;
        }

        class SvgElement implements SvgElement {
            constructor(element: SVGGraphicsElement);
        }

        class SvgShape implements SvgShape {
            public static synchronizeAnimate(element: SVGGraphicsElement, animate: SvgAnimation[], useKeyTime?: boolean, path?: SvgPath): SvgAnimation[];
            constructor(element: SVGGraphicsElement);
        }

        class SvgUse implements SvgUse {
            constructor(element: SVGUseElement, d: string);
        }

        class SvgImage implements SvgImage {
            constructor(element: SVGImageElement | SVGUseElement, href?: string);
        }

        class SvgPath implements SvgPath {
            public static getLine(x1: number, y1: number, x2?: number, y2?: number): string;
            public static getCircle(cx: number, cy: number, r: number): string;
            public static getEllipse(cx: number, cy: number, rx: number, ry: number): string;
            public static getRect(width: number, height: number, x?: number, y?: number): string;
            public static getPolygon(points: Point[] | DOMPoint[]): string;
            public static getPolyline(points: Point[] | DOMPoint[]): string;
            constructor(element: SVGGraphicsElement, d?: string);
        }
    }
}

export = squared.svg.SvgElement;