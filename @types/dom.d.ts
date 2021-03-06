interface BoxRect {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

interface BoxRectDimension extends BoxRect, Dimension {
    numberOfLines?: number;
}

interface BoxRectPosition extends BoxRect {
    static: boolean;
    topAsPercent: number;
    rightAsPercent: number;
    bottomAsPercent: number;
    leftAsPercent: number;
    horizontal: string;
    vertical: string;
    orientation: string[];
}

interface BoxMargin {
    marginTop: number;
    marginRight: number;
    marginBottom: number;
    marginLeft: number;
}

interface BoxPadding {
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
}

interface BoxModel extends BoxMargin, BoxPadding {
    borderTopWidth?: number;
    borderRightWidth?: number;
    borderBottomWidth?: number;
    borderLeftWidth?: number;
}

interface Flexbox {
    alignSelf: string;
    justifySelf: string;
    basis: string;
    grow: number;
    shrink: number;
    order: number;
}

interface BorderAttribute {
    width: string;
    style: string;
    color: ColorData;
}

interface FontAttribute {
    fontFamily: string;
    fontStyle: string;
    fontSize: string;
    fontWeight: string;
    color: string;
    backgroundColor?: string;
}

interface BoxBorder {
    borderTop: BorderAttribute;
    borderRight: BorderAttribute;
    borderBottom: BorderAttribute;
    borderLeft: BorderAttribute;
}

interface BoxStyle extends Optional<BoxBorder> {
    backgroundSize: string;
    backgroundRepeat: string;
    backgroundPositionX: string;
    backgroundPositionY: string;
    backgroundColor?: string;
    backgroundClip?: BoxRect;
    backgroundOrigin?: BoxRect;
    borderRadius?: string[];
    outline?: BorderAttribute;
    backgroundImage?: (string | Gradient)[];
}

interface Gradient {
    type: string;
    colorStops: ColorStop[];
    dimension?: Dimension;
}

interface RepeatingGradient extends Gradient {
    repeating: boolean;
    horizontal: boolean;
}

interface LinearGradient extends RepeatingGradient {
    angle: number;
    angleExtent: Point;
}

interface RadialGradient extends RepeatingGradient {
    shape: string;
    center: BoxRectPosition;
    radius: number;
    radiusExtent: number;
    closestSide: number;
    farthestSide: number;
    closestCorner: number;
    farthestCorner: number;
}

interface ConicGradient extends Gradient {
    angle: number;
    center: BoxRectPosition;
}

interface ColorStop {
    color: ColorData;
    offset: number;
}

interface ImageSrcSet {
    src: string;
    width: number;
    pixelRatio: number;
    actualWidth?: number;
}

interface QueryData {
    all: boolean;
    tagName?: string;
    id?: string;
    adjacent?: string;
    classList?: string[];
    attrList?: QueryAttribute[];
    pseudoList?: string[];
    notList?: string[];
}

interface QueryAttribute extends StringValue {
    symbol?: string;
    caseInsensitive: boolean;
}

type BoxType = "bounds" | "box" | "linear";