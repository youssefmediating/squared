import { SvgTransformExclusions } from '../../../src/svg/@types/object';

export interface ConstraintGuidelineOptions {
    circlePosition: boolean;
}

export interface ResourceSvgOptions {
    excludeFromTransform: SvgTransformExclusions;
    vectorAnimateInterpolator: string;
}

export interface ResourceBackgroundOptions {
    autoSizeBackgroundImage: true;
}

export interface ResourceStringsOptions {
    numberResourceValue: false;
}