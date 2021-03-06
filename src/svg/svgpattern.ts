import { SvgBuildOptions } from '../../@types/svg/object';

import SvgView$MX from './svgview-mx';
import SvgAnimation from './svganimation';
import SvgContainer from './svgcontainer';

import { INSTANCE_TYPE } from './lib/constant';

export default class SvgPattern extends SvgView$MX(SvgContainer) implements squared.svg.SvgPattern {
    constructor(
        public element: SVGGraphicsElement,
        public readonly patternElement: SVGPatternElement)
    {
        super(element);
    }

    public build(options?: SvgBuildOptions) {
        super.build({ ...options, patternElement: this.patternElement, initialize: false });
    }

    get animations(): SvgAnimation[] {
        return [];
    }

    get instanceType() {
        return INSTANCE_TYPE.SVG_PATTERN;
    }
}