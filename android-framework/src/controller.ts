import { ControllerSettings, LayoutType, SessionData } from '../../src/base/@types/application';
import { UserSettingsAndroid } from './@types/application';
import { ViewAttribute } from './@types/node';

import Resource from './resource';
import View from './view';
import ViewGroup from './viewgroup';

import { AXIS_ANDROID, BOX_ANDROID, CONTAINER_ANDROID, XMLNS_ANDROID } from './lib/constant';
import { BUILD_ANDROID, CONTAINER_NODE } from './lib/enumeration';
import { createViewAttribute, getXmlNs, replaceTab, replaceLength } from './lib/util';

import BASE_TMPL from './template/base';

import $Layout = squared.base.Layout;
import $NodeList = squared.base.NodeList;

const $enum = squared.base.lib.enumeration;
const $color = squared.lib.color;
const $css = squared.lib.css;
const $dom = squared.lib.dom;
const $element = squared.lib.element;
const $math = squared.lib.math;
const $util = squared.lib.util;
const $xml = squared.lib.xml;

const REGEXP_DATASETATTR = /^attr[A-Z]/;

const GUIDELINE_AXIS = [AXIS_ANDROID.HORIZONTAL, AXIS_ANDROID.VERTICAL];

function createColumnLayout<T extends View>(partition: T[][], horizontal: boolean) {
    let LT: string;
    let RB: string;
    let LRTB: string;
    let RLBT: string;
    if (horizontal) {
        LT = 'left';
        RB = 'right';
        LRTB = 'leftRight';
        RLBT = 'rightLeft';
    }
    else {
        LT = 'top';
        RB = 'bottom';
        LRTB = 'topBottom';
        RLBT = 'bottomTop';
    }
    for (const seg of partition) {
        const rowStart = seg[0];
        const rowEnd = seg[seg.length - 1];
        rowStart.anchor(LT, 'parent');
        rowEnd.anchor(RB, 'parent');
        for (let i = 0; i < seg.length; i++) {
            const chain = seg[i];
            const previous = seg[i - 1] as T | undefined;
            const next = seg[i + 1] as T | undefined;
            if (horizontal) {
                chain.app('layout_constraintVertical_bias', '0');
            }
            else if (i > 0) {
                chain.anchor('left', rowStart.documentId);
            }
            if (previous) {
                chain.anchor(LRTB, previous.documentId);
            }
            if (next) {
                chain.anchor(RLBT, next.documentId);
            }
            Controller.setConstraintDimension(chain);
            chain.anchored = true;
        }
        if (horizontal) {
            rowStart.app('layout_constraintHorizontal_chainStyle', 'spread_inside');
        }
        else {
            rowStart.app('layout_constraintVertical_chainStyle', 'packed');
        }
    }
}

function sortHorizontalFloat<T extends View>(list: T[]) {
    if (list.some(node => node.floating)) {
        const result = list.slice(0).sort((a, b) => {
            if (a.floating && !b.floating) {
                return a.float === 'left' ? -1 : 1;
            }
            else if (!a.floating && b.floating) {
                return b.float === 'left' ? 1 : -1;
            }
            else if (a.floating && b.floating) {
                if (a.float !== b.float) {
                    return a.float === 'left' ? -1 : 1;
                }
                else if (a.float === 'right' && b.float === 'right') {
                    return -1;
                }
            }
            return 0;
        });
        if (!$util.isEqual(list, result)) {
            list.length = 0;
            $util.concatArray(list, result);
            return true;
        }
    }
    return false;
}

function setBaselineLineHeight<T extends View>(node: T, baseline: T) {
    if (baseline.lineHeight > 0) {
        baseline.setLineHeight(baseline.lineHeight);
    }
    else if (node.lineHeight > 0) {
        baseline.setLineHeight(node.lineHeight + baseline.paddingTop + baseline.paddingBottom);
    }
}

function adjustBaseline<T extends View>(baseline: T, nodes: T[]) {
    for (const node of nodes) {
        if (node !== baseline) {
            if (node.imageElement && node.actualHeight > baseline.actualHeight) {
                if (node.renderParent && $util.withinRange(node.linear.top, node.renderParent.box.top)) {
                    node.anchor('top', 'true');
                }
            }
            else if (node.element && node.length === 0 || node.layoutHorizontal && node.renderChildren.every(item => item.baseline)) {
                node.anchor('baseline', baseline.documentId);
            }
        }
    }
}

function getTextBottom<T extends View>(nodes: T[]): T | undefined {
    return $util.filterArray(nodes, node => node.verticalAlign === 'text-bottom').sort((a, b) => {
        if (a.bounds.height === b.bounds.height) {
            return a.is(CONTAINER_NODE.SELECT) ? 1 : -1;
        }
        return a.bounds.height > b.bounds.height ? -1 : 1;
    })[0];
}

function checkSingleLine<T extends View>(node: T, nowrap = false) {
    if (node.textElement && node.cssAscend('textAlign', true) !== 'center' && !node.hasWidth && !node.multiline && (nowrap || node.textContent.trim().split(String.fromCharCode(32)).length > 0)) {
        node.android('singleLine', 'true');
    }
}

function adjustDocumentRootOffset<T extends View>(value: number, parent: T, direction: string, boxReset = false) {
    if (value > 0) {
        if (!boxReset) {
            value -= parent[`padding${direction}`];
        }
        if (parent.documentBody) {
            value -= parent[`margin${direction}`];
        }
        return Math.max(value, 0);
    }
    return value;
}

function adjustFloatingNegativeMargin<T extends View>(node: T, previous: T) {
    if (previous.float === 'left') {
        if (previous.marginRight < 0) {
            const right = Math.abs(previous.marginRight);
            node.modifyBox($enum.BOX_STANDARD.MARGIN_LEFT, (previous.actualWidth + (previous.hasWidth ? previous.paddingLeft + previous.borderLeftWidth : 0)) - right);
            node.anchor('left', previous.documentId);
            previous.modifyBox($enum.BOX_STANDARD.MARGIN_RIGHT, null);
            return true;
        }
    }
    else if (node.float === 'right' && previous.float === 'right') {
        if (previous.marginLeft < 0) {
            const left = Math.abs(previous.marginLeft);
            const width = previous.actualWidth;
            if (left < width) {
                node.modifyBox($enum.BOX_STANDARD.MARGIN_RIGHT, width - left);
            }
            node.anchor('right', previous.documentId);
            previous.modifyBox($enum.BOX_STANDARD.MARGIN_LEFT, null);
            return true;
        }
    }
    return false;
}

function constraintMinMax<T extends View>(node: T, dimension: string) {
    const minWH = node.cssInitial(`min${dimension}`);
    const maxWH = node.cssInitial(`max${dimension}`);
    if ($util.isLength(minWH)) {
        node.app(`layout_constraint${dimension}_min`, minWH);
        node.constraint.minWidth = true;
    }
    if ($util.isLength(maxWH)) {
        node.app(`layout_constraint${dimension}_max`, maxWH);
        node.constraint.minHeight = true;
    }
}

function constraintPercentValue<T extends View>(node: T, dimension: string, value: string, requirePX: boolean) {
    if ($util.isPercent(value)) {
        if (requirePX) {
            node.android(`layout_${dimension.toLowerCase()}`, node.convertPX(value, dimension === 'Width'));
        }
        else if (value !== '100%') {
            const percent = parseInt(value) / 100 + (node.actualParent ? node.contentBoxWidth / node.actualParent.box.width : 0);
            node.app(`layout_constraint${dimension}_percent`, percent.toPrecision(node.localSettings.constraintPercentPrecision));
            node.android(`layout_${dimension.toLowerCase()}`, '0px');
        }
    }
}

function constraintPercentWidth<T extends View>(node: T, requirePX = false) {
    const value = node.has('width') ? node.css('width') : '';
    constraintPercentValue(node, 'Width', value, requirePX);
}

function constraintPercentHeight<T extends View>(node: T, requirePX = false) {
    if (node.documentParent.hasHeight) {
        const value = node.has('height') ? node.css('height') : '';
        constraintPercentValue(node, 'Height', value, requirePX);
    }
}

function isTargeted<T extends View>(node: T, parent: T) {
    if (parent.element && node.dataset.target) {
        const element = document.getElementById(node.dataset.target);
        return element !== null && element !== parent.element;
    }
    return false;
}

function getRootNamespace(value: string) {
    let output = '';
    for (const namespace in XMLNS_ANDROID) {
        if (value.indexOf(`${namespace}:`) !== -1) {
            output += `\n\t${getXmlNs(namespace)}`;
        }
    }
    return output;
}

function parseAttributes<T extends View>(node: T) {
    if (node.dir === 'rtl') {
        node.android(node.length ? 'layoutDirection' : 'textDirection', 'rtl');
    }
    if (node.styleElement) {
        const dataset = $css.getDataSet(<HTMLElement> node.element, 'android');
        for (const name in dataset) {
            if (REGEXP_DATASETATTR.test(name)) {
                const obj = $util.capitalize(name.substring(4), false);
                for (const values of dataset[name].split(';')) {
                    const [key, value] = values.split('::');
                    if (key && value) {
                        node.attr(obj, key, value);
                    }
                }
            }
        }
    }
    return combineAttributes(node, node.renderDepth + 1);
}

function combineAttributes<T extends View>(node: T, depth: number) {
    const indent = '\t'.repeat(depth);
    let output = '';
    for (const value of node.combine()) {
        output += `\n${indent + value}`;
    }
    return output;
}

export default class Controller<T extends View> extends squared.base.Controller<T> implements android.base.Controller<T> {
    public static evaluateAnchors<T extends View>(nodes: T[]) {
        const horizontal: T[] = [];
        const vertical: T[] = [];
        for (const node of nodes) {
            if (node.constraint.horizontal) {
                horizontal.push(node);
            }
            if (node.constraint.vertical) {
                vertical.push(node);
            }
        }
        let i = -1;
        while (++i < nodes.length) {
            const node = nodes[i];
            if (!node.constraint.horizontal) {
                for (const attr in node.constraint.current) {
                    const position = node.constraint.current[attr];
                    if (position.horizontal && horizontal.find(item => item.documentId === position.documentId)) {
                        node.constraint.horizontal = true;
                        horizontal.push(node);
                        i = -1;
                        break;
                    }
                }
            }
            if (!node.constraint.vertical) {
                for (const attr in node.constraint.current) {
                    const position = node.constraint.current[attr];
                    if (!position.horizontal && vertical.find(item => item.documentId === position.documentId)) {
                        node.constraint.vertical = true;
                        vertical.push(node);
                        i = -1;
                        break;
                    }
                }
            }
        }
    }

    public static setConstraintDimension<T extends View>(node: T) {
        constraintPercentWidth(node);
        constraintPercentHeight(node);
        constraintMinMax(node, 'Width');
        constraintMinMax(node, 'Height');
    }

    public static setFlexDimension<T extends View>(node: T, horizontal: boolean) {
        let dimensionA: string;
        let dimensionB: string;
        if (horizontal) {
            dimensionA = 'width';
            dimensionB = 'height';
        }
        else {
            dimensionA = 'height';
            dimensionB = 'width';
        }
        let basis = node.flexbox.basis;
        if (basis !== 'auto') {
            if ($util.isPercent(basis)) {
                if (basis !== '0%') {
                    node.app(`layout_constraint${horizontal ? 'Width' : 'Height'}_percent`, (parseFloat(basis) / 100).toPrecision(node.localSettings.constraintPercentPrecision));
                    basis = '';
                }
            }
            else if ($util.isLength(basis)) {
                node.android(`layout_${dimensionA}`, node.convertPX(basis));
                basis = '';
            }
        }
        if (basis !== '') {
            const size = node.has(dimensionA) ? node.css(dimensionA) : '';
            if (node.flexbox.grow > 0) {
                node.android(`layout_${dimensionA}`, '0px');
                node.app(`layout_constraint${horizontal ? 'Horizontal' : 'Vertical'}_weight`, node.flexbox.grow.toString());
            }
            else if ($util.isLength(size)) {
                node.android(`layout_${dimensionA}`, size);
            }
            else if (node.flexbox.shrink > 1) {
                node.android(`layout_${dimensionA}`, 'wrap_content');
            }
            else {
                if (horizontal) {
                    constraintPercentWidth(node);
                }
                else {
                    constraintPercentHeight(node);
                }
            }
            if (node.flexbox.shrink < 1) {
                node.app(`layout_constrained${horizontal ? 'Width' : 'Height'}`, 'true');
            }
        }
        const sizeB = node.has(dimensionB) ? node.css(dimensionB) : '';
        if ($util.isLength(sizeB)) {
            node.android(`layout_${dimensionB}`, sizeB);
        }
        else {
            if (horizontal) {
                constraintPercentHeight(node, true);
            }
            else {
                constraintPercentWidth(node, true);
            }
        }
        constraintMinMax(node, 'Width');
        constraintMinMax(node, 'Height');
    }

    public readonly localSettings: ControllerSettings = {
        baseTemplate: BASE_TMPL,
        floatPrecision: 3,
        layout: {
            pathName: 'res/layout',
            fileExtension: 'xml'
        },
        unsupported: {
            excluded: new Set(['BR']),
            tagName: new Set(['OPTION', 'INPUT:hidden', 'MAP', 'AREA', 'svg'])
        },
        relative: {
            superscriptFontScale: -4,
            subscriptFontScale: -4
        },
        constraint: {
            withinParentBottomOffset: 3.5,
            percentPrecision: 4
        }
    };

    public finalize(data: SessionData<$NodeList<T>>) {
        const templates = data.templates;
        if (this.userSettings.showAttributes) {
            for (const node of data.cache) {
                if (node.visible) {
                    const hash = $xml.formatPlaceholder(node.id, '@');
                    if (templates.length === 1) {
                        templates[0].content = templates[0].content.replace(hash, parseAttributes(node));
                    }
                    else {
                        for (const view of templates) {
                            if (view.content.indexOf(hash) !== -1) {
                                view.content = view.content.replace(hash, parseAttributes(node));
                                break;
                            }
                        }
                    }
                }
            }
        }
        for (const view of templates) {
            view.content = this.removePlaceholders(
                replaceTab(
                    replaceLength(
                        view.content.replace(/{#0}/, getRootNamespace(view.content)),
                        this.userSettings.resolutionDPI,
                        this.userSettings.convertPixels
                    ),
                    this.userSettings.insertSpaces
                )
            );
        }
    }

    public processUnknownParent(layout: $Layout<T>) {
        const node = layout.node;
        let next = false;
        let renderAs: T | undefined;
        if (node.has('columnCount')) {
            layout.columnCount = node.toInt('columnCount');
            layout.setType(CONTAINER_NODE.CONSTRAINT, $enum.NODE_ALIGNMENT.COLUMN, $enum.NODE_ALIGNMENT.AUTO_LAYOUT);
        }
        else if (layout.some(item => !item.pageFlow)) {
            layout.setType(CONTAINER_NODE.CONSTRAINT, $enum.NODE_ALIGNMENT.ABSOLUTE, $enum.NODE_ALIGNMENT.UNKNOWN);
        }
        else {
            if (layout.length === 1) {
                const child = node.item(0) as T;
                if (node.documentRoot && isTargeted(child, node)) {
                    node.hide();
                    next = true;
                }
                else if (
                    this.userSettings.collapseUnattributedElements &&
                    node.element &&
                    node.positionStatic &&
                    !node.elementId &&
                    !node.dataset.use &&
                    !node.dataset.target &&
                    !node.hasWidth &&
                    !node.hasHeight &&
                    !node.has('maxWidth') &&
                    !node.has('maxHeight') &&
                    !node.visibleStyle.background &&
                    !node.has('textAlign') && !node.has('verticalAlign') &&
                    node.toInt('lineHeight') > 0 &&
                    !node.rightAligned && !node.autoMargin.horizontal &&
                    !node.groupParent &&
                    !node.companion &&
                    !this.hasAppendProcessing(node.id))
                {
                    child.documentRoot = node.documentRoot;
                    child.siblingIndex = node.siblingIndex;
                    child.parent = layout.parent;
                    node.renderAs = child;
                    node.resetBox($enum.BOX_STANDARD.MARGIN | $enum.BOX_STANDARD.PADDING, child, true);
                    node.hide();
                    renderAs = child;
                }
                else {
                    layout.setType(CONTAINER_NODE.FRAME, $enum.NODE_ALIGNMENT.SINGLE);
                }
            }
            else {
                layout.init();
                if (node.element && $element.hasLineBreak(node.element, true)) {
                    layout.setType(CONTAINER_NODE.LINEAR, $enum.NODE_ALIGNMENT.VERTICAL, $enum.NODE_ALIGNMENT.UNKNOWN);
                }
                else if (this.checkConstraintFloat(layout)) {
                    layout.setType(CONTAINER_NODE.CONSTRAINT, $enum.NODE_ALIGNMENT.NOWRAP);
                }
                else if (layout.linearX) {
                    if (this.checkFrameHorizontal(layout)) {
                        layout.renderType = $enum.NODE_ALIGNMENT.FLOAT | $enum.NODE_ALIGNMENT.HORIZONTAL;
                    }
                    else if (this.checkConstraintHorizontal(layout)) {
                        layout.setType(CONTAINER_NODE.CONSTRAINT);
                    }
                    else if (this.checkRelativeHorizontal(layout)) {
                        layout.setType(CONTAINER_NODE.RELATIVE);
                    }
                    else {
                        layout.setType(CONTAINER_NODE.LINEAR);
                        if (layout.floated.size) {
                            layout.renderPosition = sortHorizontalFloat(layout.children);
                        }
                    }
                    layout.add($enum.NODE_ALIGNMENT.HORIZONTAL);
                }
                else if (layout.linearY) {
                    layout.setType(CONTAINER_NODE.LINEAR, $enum.NODE_ALIGNMENT.VERTICAL, node.documentRoot ? $enum.NODE_ALIGNMENT.UNKNOWN : 0);
                }
                else if (layout.every(item => item.inlineFlow)) {
                    if (this.checkFrameHorizontal(layout)) {
                        layout.renderType = $enum.NODE_ALIGNMENT.FLOAT | $enum.NODE_ALIGNMENT.HORIZONTAL;
                    }
                    else {
                        layout.setType(CONTAINER_NODE.RELATIVE, $enum.NODE_ALIGNMENT.HORIZONTAL, $enum.NODE_ALIGNMENT.UNKNOWN);
                    }
                }
                else if (layout.some(item => item.alignedVertically(item.previousSiblings(), layout.children, layout.cleared))) {
                    layout.setType(CONTAINER_NODE.LINEAR, $enum.NODE_ALIGNMENT.VERTICAL, $enum.NODE_ALIGNMENT.UNKNOWN);
                }
                else {
                    layout.setType(CONTAINER_NODE.CONSTRAINT, $enum.NODE_ALIGNMENT.UNKNOWN);
                }
            }
        }
        return { layout, next, renderAs };
    }

    public processUnknownChild(layout: $Layout<T>) {
        const node = layout.node;
        const visible = node.visibleStyle;
        let next = false;
        if (node.inlineText || visible.borderWidth && node.textContent.length) {
            layout.setType(CONTAINER_NODE.TEXT);
        }
        else if (visible.backgroundImage && !visible.backgroundRepeat && (!node.inlineText || node.toInt('textIndent') + node.actualWidth < 0)) {
            layout.setType(CONTAINER_NODE.IMAGE, $enum.NODE_ALIGNMENT.SINGLE);
            node.exclude({ resource: $enum.NODE_RESOURCE.FONT_STYLE | $enum.NODE_RESOURCE.VALUE_STRING });
        }
        else if (node.block && (visible.borderWidth || visible.backgroundImage || visible.paddingVertical)) {
            layout.setType(CONTAINER_NODE.LINE);
        }
        else if (!node.documentRoot) {
            if (this.userSettings.collapseUnattributedElements && node.element && node.bounds.height === 0 && !visible.background && !node.elementId && !node.dataset.use) {
                node.hide();
                next = true;
            }
            else {
                layout.setType(visible.background ? CONTAINER_NODE.TEXT : CONTAINER_NODE.FRAME);
            }
        }
        return { layout, next };
    }

    public processTraverseHorizontal(layout: $Layout<T>, siblings?: T[]) {
        const { node, parent, children } = layout;
        if (this.checkFrameHorizontal(layout)) {
            layout.node = this.createNodeGroup(node, children, parent);
            layout.renderType |= $enum.NODE_ALIGNMENT.FLOAT | $enum.NODE_ALIGNMENT.HORIZONTAL;
        }
        else if (siblings === undefined || layout.length !== siblings.length) {
            layout.node = this.createNodeGroup(node, children, parent);
            this.processLayoutHorizontal(layout);
        }
        else {
            parent.alignmentType |= $enum.NODE_ALIGNMENT.HORIZONTAL;
        }
        return { layout };
    }

    public processTraverseVertical(layout: $Layout<T>, siblings?: T[]) {
        const { node, parent, children, floated, cleared } = layout;
        if (floated.size && cleared.size && !(floated.size === 1 && layout.every((item, index) => index === 0 || index === layout.length - 1 || cleared.has(item)))) {
            layout.node = this.createNodeGroup(node, children, parent);
            layout.renderType |= $enum.NODE_ALIGNMENT.FLOAT | $enum.NODE_ALIGNMENT.VERTICAL;
        }
        else if (siblings === undefined || layout.length !== siblings.length) {
            if (!parent.layoutVertical) {
                layout.node = this.createNodeGroup(node, children, parent);
                layout.setType(CONTAINER_NODE.LINEAR, $enum.NODE_ALIGNMENT.VERTICAL);
            }
        }
        else {
            parent.alignmentType |= $enum.NODE_ALIGNMENT.VERTICAL;
        }
        return { layout };
    }

    public processLayoutHorizontal(layout: $Layout<T>, strictMode = false) {
        let containerType = 0;
        if (this.checkConstraintFloat(layout)) {
            layout.setType(CONTAINER_NODE.CONSTRAINT, $enum.NODE_ALIGNMENT.NOWRAP);
        }
        else if (this.checkConstraintHorizontal(layout)) {
            containerType = CONTAINER_NODE.CONSTRAINT;
        }
        else if (this.checkRelativeHorizontal(layout)) {
            containerType = CONTAINER_NODE.RELATIVE;
        }
        else if (!strictMode || layout.linearX && !layout.floated.has('right')) {
            containerType = CONTAINER_NODE.LINEAR;
            if (layout.floated.size) {
                layout.renderPosition = sortHorizontalFloat(layout.children);
            }
        }
        if (containerType !== 0) {
            layout.setType(containerType, $enum.NODE_ALIGNMENT.HORIZONTAL);
        }
        return { layout };
    }

    public sortRenderPosition(parent: T, children: T[]) {
        if (parent.layoutConstraint && children.some(item => !item.pageFlow)) {
            const below: T[] = [];
            const middle: T[] = [];
            const above: T[] = [];
            for (const item of children) {
                if (item.pageFlow || item.actualParent !== parent) {
                    middle.push(item);
                }
                else if (item.zIndex >= 0) {
                    above.push(item);
                }
                else {
                    below.push(item);
                }
            }
            return $util.concatMultiArray(
                $util.sortArray(below, true, 'zIndex', 'id'),
                middle,
                $util.sortArray(above, true, 'zIndex', 'id')
            );
        }
        return [];
    }

    public checkFrameHorizontal(layout: $Layout<T>) {
        const [floating, sibling] = layout.partition(node => node.floating);
        if (layout.floated.size === 2 || layout.cleared.size || layout.some(node => node.pageFlow && node.autoMargin.horizontal)) {
            return true;
        }
        else if (sibling.length) {
            if (layout.floated.has('right')) {
                return true;
            }
            else if (!this.userSettings.floatOverlapDisabled && layout.floated.has('left') && sibling.some(node => node.blockStatic)) {
                let flowIndex = Number.POSITIVE_INFINITY;
                for (const node of sibling) {
                    flowIndex = Math.min(flowIndex, node.siblingIndex);
                }
                return $util.replaceMap<T, number>(floating, node => node.siblingIndex).some(value => value < flowIndex);
            }
        }
        return false;
    }

    public checkConstraintFloat(layout: $Layout<T>) {
        return layout.floated.size === 1 && layout.every(node => node.floating && node.marginLeft >= 0 && node.marginRight >= 0 && (!node.positionRelative || node.left >= 0 && node.top >= 0));
    }

    public checkConstraintHorizontal(layout: $Layout<T>) {
        let sameHeight = true;
        let previousHeight = layout.children[0].actualHeight;
        for (let i = 1; i < layout.length; i++) {
            const height = layout.children[i].actualHeight;
            if (previousHeight !== height) {
                sameHeight = false;
                break;
            }
            previousHeight = height;
        }
        return (
            !sameHeight &&
            !layout.parent.hasHeight &&
            layout.some(node => node.verticalAlign === 'bottom') &&
            layout.every(node => node.inlineVertical && (node.baseline || node.verticalAlign === 'bottom'))
        );
    }

    public checkRelativeHorizontal(layout: $Layout<T>) {
        if (layout.floated.size === 2) {
            return false;
        }
        return layout.some(node => node.positionRelative || node.textElement || node.imageElement || !node.baseline);
    }

    public setConstraints() {
        for (const node of this.cache) {
            if (node.visible && (node.layoutRelative || node.layoutConstraint) && !node.hasBit('excludeProcedure', $enum.NODE_PROCEDURE.CONSTRAINT)) {
                const children = node.renderFilter(item => !item.positioned) as T[];
                if (children.length) {
                    if (node.layoutRelative) {
                        this.processRelativeHorizontal(node, children);
                    }
                    else if (node.layoutConstraint) {
                        const [pageFlow, absolute] = $util.partitionArray(children, item => item.pageFlow);
                        let bottomParent = node.box.bottom;
                        if (absolute.length) {
                            node.renderEach(item => bottomParent = Math.max(bottomParent, item.linear.bottom));
                            for (const item of absolute) {
                                if (!item.positionAuto && (item.documentParent === item.absoluteParent || item.position === 'fixed')) {
                                    if (item.hasWidth && item.autoMargin.horizontal) {
                                        if (item.has('left') && item.autoMargin.right) {
                                            item.anchor('left', 'parent');
                                            item.modifyBox($enum.BOX_STANDARD.MARGIN_LEFT, item.left);
                                        }
                                        else if (item.has('right') && item.autoMargin.left) {
                                            item.anchor('right', 'parent');
                                            item.modifyBox($enum.BOX_STANDARD.MARGIN_RIGHT, item.right);
                                        }
                                        else {
                                            item.anchorParent(AXIS_ANDROID.HORIZONTAL);
                                            item.modifyBox($enum.BOX_STANDARD.MARGIN_LEFT, item.left);
                                            item.modifyBox($enum.BOX_STANDARD.MARGIN_RIGHT, item.right);
                                        }
                                    }
                                    else {
                                        if (item.has('left')) {
                                            item.anchor('left', 'parent');
                                            item.modifyBox($enum.BOX_STANDARD.MARGIN_LEFT, adjustDocumentRootOffset(item.left, node, 'Left'));
                                        }
                                        if (item.has('right') && (!item.hasWidth || !item.has('left'))) {
                                            item.anchor('right', 'parent');
                                            item.modifyBox($enum.BOX_STANDARD.MARGIN_RIGHT, adjustDocumentRootOffset(item.right, node, 'Right'));
                                        }
                                    }
                                    if (item.hasHeight && item.autoMargin.vertical) {
                                        if (item.has('top') && item.autoMargin.bottom) {
                                            item.anchor('top', 'parent');
                                            item.modifyBox($enum.BOX_STANDARD.MARGIN_TOP, item.top);
                                        }
                                        else if (item.has('bottom') && item.autoMargin.top) {
                                            item.anchor('bottom', 'parent');
                                            item.modifyBox($enum.BOX_STANDARD.MARGIN_BOTTOM, item.bottom);
                                        }
                                        else {
                                            item.anchorParent(AXIS_ANDROID.VERTICAL);
                                            item.modifyBox($enum.BOX_STANDARD.MARGIN_TOP, item.top);
                                            item.modifyBox($enum.BOX_STANDARD.MARGIN_BOTTOM, item.bottom);
                                        }
                                    }
                                    else {
                                        if (item.has('top')) {
                                            const reset = node.valueBox($enum.BOX_STANDARD.PADDING_TOP);
                                            item.anchor('top', 'parent');
                                            item.modifyBox($enum.BOX_STANDARD.MARGIN_TOP, adjustDocumentRootOffset(item.top, node, 'Top', reset[0] === 1));
                                        }
                                        if (item.has('bottom') && (!item.hasHeight || !item.has('top'))) {
                                            const reset = node.valueBox($enum.BOX_STANDARD.PADDING_BOTTOM);
                                            item.anchor('bottom', 'parent');
                                            item.modifyBox($enum.BOX_STANDARD.MARGIN_BOTTOM, adjustDocumentRootOffset(item.bottom, node, 'Bottom', reset[0] === 1));
                                        }
                                    }
                                    item.positioned = true;
                                }
                            }
                        }
                        if (node.layoutHorizontal) {
                            this.processConstraintHorizontal(node, pageFlow);
                        }
                        else if (node.hasAlign($enum.NODE_ALIGNMENT.COLUMN)) {
                            this.processConstraintColumn(node, pageFlow);
                        }
                        else if (pageFlow.length > 1) {
                            this.processConstraintChain(node, pageFlow, bottomParent);
                        }
                        else {
                            for (const item of pageFlow) {
                                if (item.autoMargin.leftRight || (item.inlineStatic && item.cssAscend('textAlign', true) === 'center')) {
                                    item.anchorParent(AXIS_ANDROID.HORIZONTAL);
                                }
                                else if (item.rightAligned) {
                                    item.anchor('right', 'parent');
                                }
                                else if ($util.withinRange(item.linear.left, node.box.left) || item.linear.left < node.box.left) {
                                    item.anchor('left', 'parent');
                                }
                                if ($util.withinRange(item.linear.top, node.box.top) || item.linear.top < node.box.top) {
                                    item.anchor('top', 'parent');
                                }
                                if (this.withinParentBottom(item.linear.bottom, bottomParent) && item.actualParent && !item.actualParent.documentBody) {
                                    item.anchor('bottom', 'parent');
                                }
                                Controller.setConstraintDimension(item);
                            }
                        }
                        Controller.evaluateAnchors(pageFlow);
                        for (const item of children) {
                            if (!item.anchored) {
                                this.addGuideline(item, node);
                                if (item.pageFlow) {
                                    Controller.evaluateAnchors(pageFlow);
                                }
                            }
                            if (!item.hasWidth && item.alignParent('left') && item.alignParent('right')) {
                                item.android('layout_width', 'match_parent');
                            }
                            if (!item.hasHeight && item.alignParent('top') && item.alignParent('bottom')) {
                                item.android('layout_height', 'match_parent');
                            }
                        }
                    }
                }
            }
        }
    }

    public renderNodeGroup(layout: $Layout<T>) {
        const { node, parent, containerType, alignmentType, rowCount, columnCount } = layout;
        const options = createViewAttribute();
        let valid = false;
        switch (containerType) {
            case CONTAINER_NODE.LINEAR:
                if ($util.hasBit(alignmentType, $enum.NODE_ALIGNMENT.VERTICAL)) {
                    options.android.orientation = AXIS_ANDROID.VERTICAL;
                    valid = true;
                }
                else if ($util.hasBit(alignmentType, $enum.NODE_ALIGNMENT.HORIZONTAL)) {
                    options.android.orientation = AXIS_ANDROID.HORIZONTAL;
                    valid = true;
                }
                break;
            case CONTAINER_NODE.GRID:
                options.android.rowCount = rowCount ? rowCount.toString() : '';
                options.android.columnCount = columnCount ? columnCount.toString() : '2';
                valid = true;
                break;
            case CONTAINER_NODE.FRAME:
            case CONTAINER_NODE.RELATIVE:
            case CONTAINER_NODE.CONSTRAINT:
                valid = true;
                break;
        }
        if (valid) {
            const target = !node.dataset.use ? node.dataset.target : undefined;
            const controlName = View.getControlName(containerType);
            node.alignmentType |= alignmentType;
            node.setControlType(controlName, containerType);
            node.render(target ? this.application.resolveTarget(target, node) : parent);
            node.apply(options);
            return this.getEnclosingTag(controlName, node.id, target ? -1 : node.renderDepth, $xml.formatPlaceholder(node.id));
        }
        return '';
    }

    public renderNode(layout: $Layout<T>) {
        const { node, parent, containerType, alignmentType } = layout;
        node.alignmentType |= alignmentType;
        const controlName = View.getControlName(containerType);
        node.setControlType(controlName, containerType);
        const target = !node.dataset.use ? node.dataset.target : undefined;
        if (node.element) {
            switch (node.element.tagName) {
                case 'IMG': {
                    if (!node.hasBit('excludeResource', $enum.NODE_RESOURCE.IMAGE_SOURCE)) {
                        const element = <HTMLImageElement> node.element;
                        const widthPercent = node.has('width', $enum.CSS_STANDARD.PERCENT);
                        const heightPercent = node.has('height', $enum.CSS_STANDARD.PERCENT);
                        const width = node.toFloat('width');
                        const height = node.toFloat('height');
                        let scaleType: string;
                        if (widthPercent || heightPercent) {
                            scaleType = widthPercent && heightPercent ? 'fitXY' : 'fitCenter';
                        }
                        else {
                            switch (node.css('objectFit')) {
                                case 'contain':
                                    scaleType = 'centerInside';
                                    break;
                                case 'cover':
                                    scaleType = 'centerCrop';
                                    break;
                                case 'scale-down':
                                    scaleType = 'fitCenter';
                                    break;
                                case 'none':
                                    scaleType = 'matrix';
                                    break;
                                default:
                                    scaleType = 'fitXY';
                                    break;
                            }
                        }
                        node.android('scaleType', scaleType);
                        if (width > 0 && height === 0 || width === 0 && height > 0) {
                            node.android('adjustViewBounds', 'true');
                        }
                        if (node.baseline) {
                            node.android('baselineAlignBottom', 'true');
                        }
                        const src = Resource.addImageSrc(element);
                        if (src !== '') {
                            node.android('src', `@drawable/${src}`);
                        }
                        if (!node.pageFlow && node.left < 0 || node.top < 0) {
                            const absoluteParent = node.absoluteParent;
                            if (absoluteParent && absoluteParent.css('overflow') === 'hidden') {
                                const container = this.application.createNode($element.createElement(node.actualParent ? node.actualParent.element : null));
                                container.setControlType(CONTAINER_ANDROID.FRAME, CONTAINER_NODE.FRAME);
                                container.inherit(node, 'base');
                                container.exclude({
                                    procedure: $enum.NODE_PROCEDURE.ALL,
                                    resource: $enum.NODE_RESOURCE.ALL
                                });
                                container.cssApply({
                                    position: node.position,
                                    zIndex: node.zIndex.toString()
                                });
                                parent.appendTry(node, container);
                                this.cache.append(container);
                                if (width > 0) {
                                    container.android('layout_width', width < parent.box.width ? $util.formatPX(width) : 'match_parent');
                                }
                                else {
                                    container.android('layout_width', 'wrap_content');
                                }
                                if (height > 0) {
                                    container.android('layout_height', height < parent.box.height ? $util.formatPX(height) : 'match_parent');
                                }
                                else {
                                    container.android('layout_height', 'wrap_content');
                                }
                                container.render(target ? this.application.resolveTarget(target, container) : parent);
                                container.companion = node;
                                container.saveAsInitial();
                                node.modifyBox($enum.BOX_STANDARD.MARGIN_TOP, node.top);
                                node.modifyBox($enum.BOX_STANDARD.MARGIN_LEFT, node.left);
                                node.render(container);
                                return this.getEnclosingTag(
                                    CONTAINER_ANDROID.FRAME,
                                    container.id,
                                    target ? -1 : container.renderDepth,
                                    this.getEnclosingTag(controlName, node.id, target ? 0 : node.renderDepth)
                                );
                            }
                        }
                    }
                    break;
                }
                case 'INPUT': {
                    const element = <HTMLInputElement> node.element;
                    switch (element.type) {
                        case 'checkbox':
                            if (element.checked) {
                                node.android('checked', 'true');
                            }
                            break;
                        case 'text':
                            node.android('inputType', 'text');
                            break;
                        case 'password':
                            node.android('inputType', 'textPassword');
                            break;
                        case 'range':
                            if (element.value) {
                                node.android('progress', element.value);
                            }
                        case 'time':
                        case 'week':
                        case 'month':
                        case 'number':
                        case 'datetime-local':
                            if (element.min) {
                                node.android('min', element.min);
                            }
                            if (element.max) {
                                node.android('max', element.max);
                            }
                            break;
                        case 'url':
                        case 'email':
                        case 'search':
                        case 'tel':
                            if (element.minLength !== -1) {
                                node.android('minLength', element.minLength.toString());
                            }
                            if (element.maxLength > 0) {
                                node.android('maxLength', element.maxLength.toString());
                            }
                            break;
                    }
                    switch (controlName) {
                        case CONTAINER_ANDROID.EDIT:
                        case CONTAINER_ANDROID.RANGE:
                            if (!node.hasWidth && element.size > 0) {
                                node.css('width', $util.formatPX(element.size * 7), true);
                            }
                            break;
                    }
                    break;
                }
                case 'SELECT': {
                    const element = <HTMLSelectElement> node.element;
                    if (element.size > 1 && !node.cssInitial('verticalAlign')) {
                        node.css('verticalAlign', 'text-bottom', true);
                    }
                    break;
                }
                case 'TEXTAREA': {
                    const element = <HTMLTextAreaElement> node.element;
                    node.android('minLines', '2');
                    if (element.rows > 2) {
                        node.android('lines', element.rows.toString());
                    }
                    if (element.maxLength > 0) {
                        node.android('maxLength', element.maxLength.toString());
                    }
                    if (!node.hasWidth && element.cols > 0) {
                        node.css('width', $util.formatPX(element.cols * 8), true);
                    }
                    node.android('hint', element.placeholder);
                    node.android('scrollbars', AXIS_ANDROID.VERTICAL);
                    node.android('inputType', 'textMultiLine');
                    if (node.overflowX) {
                        node.android('scrollHorizontally', 'true');
                    }
                    if (!node.cssInitial('verticalAlign')) {
                        node.css('verticalAlign', 'text-bottom', true);
                    }
                    break;
                }
            }
        }
        if (node.inlineVertical) {
            switch (node.verticalAlign) {
                case 'sub':
                    node.modifyBox($enum.BOX_STANDARD.MARGIN_BOTTOM, Math.ceil(node.fontSize / this.localSettings.relative.subscriptFontScale));
                    break;
                case 'super':
                    node.modifyBox($enum.BOX_STANDARD.MARGIN_TOP, Math.ceil(node.fontSize / this.localSettings.relative.superscriptFontScale));
                    break;
            }
        }
        switch (controlName) {
            case CONTAINER_ANDROID.TEXT:
                let overflow = '';
                if (node.overflowX) {
                    overflow += AXIS_ANDROID.HORIZONTAL;
                }
                if (node.overflowY) {
                    overflow += (overflow !== '' ? '|' : '') + AXIS_ANDROID.VERTICAL;
                }
                if (overflow !== '') {
                    node.android('scrollbars', overflow);
                }
                if (node.has('letterSpacing')) {
                    node.android('letterSpacing', node.css('letterSpacing'));
                }
                if (node.css('textAlign') === 'justify') {
                    node.android('justificationMode', 'inter_word');
                }
                if (node.has('textShadow')) {
                    [/^(rgba?\(\d+, \d+, \d+(?:, [\d.]+)?\)) ([\d.]+[a-z]+) ([\d.]+[a-z]+) ([\d.]+[a-z]+)$/, /^([\d.]+[a-z]+) ([\d.]+[a-z]+) ([\d.]+[a-z]+) (.+)$/].some((pattern, index) => {
                        const match = node.css('textShadow').match(pattern);
                        if (match) {
                            const color = $color.parseColor(match[index === 0 ? 1 : 4]);
                            if (color) {
                                const colorName = Resource.addColor(color);
                                if (colorName !== '') {
                                    node.android('shadowColor', `@color/${colorName}`);
                                }
                            }
                            node.android('shadowDx', $util.convertInt(match[index === 0 ? 2 : 1]).toString());
                            node.android('shadowDy', $util.convertInt(match[index === 0 ? 3 : 2]).toString());
                            node.android('shadowRadius', $util.convertInt(match[index === 0 ? 4 : 3]).toString());
                            return true;
                        }
                        return false;
                    });
                }
                if (node.lineHeight > 0 && node.multiline) {
                    if (node.support.lineHeight) {
                        node.android('lineHeight', $util.formatPX(node.lineHeight));
                    }
                    else {
                        node.android('lineSpacingExtra', $util.formatPX(node.lineHeight / 2));
                    }
                }
                if (node.css('whiteSpace') === 'nowrap') {
                    node.android('singleLine', 'true');
                }
                break;
            case CONTAINER_ANDROID.BUTTON:
                if (node.cssInitial('verticalAlign') === '') {
                    node.css('verticalAlign', 'text-bottom', true);
                }
                break;
            case CONTAINER_ANDROID.LINE:
                if (!node.hasHeight) {
                    node.android('layout_height', $util.formatPX(node.contentBoxHeight || 1));
                }
                break;
        }
        if (node.textElement || node.imageElement || node.svgElement) {
            if (node.has('maxWidth')) {
                node.android('maxWidth', node.convertPX(node.css('maxWidth')));
            }
            if (node.has('maxHeight')) {
                node.android('maxHeight', node.convertPX(node.css('maxHeight'), false));
            }
        }
        node.render(target ? this.application.resolveTarget(target, node) : parent);
        return this.getEnclosingTag(controlName, node.id, target ? -1 : node.renderDepth);
    }

    public renderNodeStatic(controlName: string, depth: number, options: ExternalData = {}, width = '', height = '', node?: T, children?: boolean) {
        const renderDepth = Math.max(0, depth);
        if (node) {
            node.renderDepth = renderDepth;
            node.rendered = true;
        }
        else {
            node = new View(0, undefined, this.afterInsertNode) as T;
        }
        node.apply(options);
        node.android('layout_width', width, false);
        node.android('layout_height', height, false);
        if (node.containerType === 0 || node.controlName === '') {
            node.setControlType(controlName);
        }
        let output = this.getEnclosingTag(controlName, node.id, !node.documentRoot && depth === 0 ? -1 : depth, children ? $xml.formatPlaceholder(node.id) : '');
        if (this.userSettings.showAttributes && node.id === 0) {
            output = output.replace($xml.formatPlaceholder(node.id, '@'), combineAttributes(node, renderDepth + 1));
        }
        options.documentId = node.documentId;
        return output;
    }

    public renderSpace(depth: number, width: string, height = '', columnSpan = 0, rowSpan = 0, options?: ViewAttribute) {
        options = createViewAttribute(options);
        if ($util.isPercent(width)) {
            options.android.layout_columnWeight = (parseFloat(width) / 100).toPrecision(this.localSettings.floatPrecision);
            width = '0px';
        }
        if ($util.isPercent(height)) {
            options.android.layout_rowWeight = (parseFloat(height) / 100).toPrecision(this.localSettings.floatPrecision);
            height = '0px';
        }
        if (columnSpan > 0) {
            options.android.layout_columnSpan = columnSpan.toString();
        }
        if (rowSpan > 0) {
            options.android.layout_rowSpan = rowSpan.toString();
        }
        return this.renderNodeStatic(CONTAINER_ANDROID.SPACE, depth, options, width, $util.hasValue(height) ? height : 'wrap_content');
    }

    public addGuideline(node: T, parent: T, orientation = '', percent = false, opposite = false) {
        const documentParent = parent.groupParent ? parent : node.documentParent as T;
        GUIDELINE_AXIS.forEach(value => {
            if (!node.constraint[value] && (orientation === '' || value === orientation)) {
                const horizontal = value === AXIS_ANDROID.HORIZONTAL;
                let LT: string;
                let RB: string;
                let LTRB: string;
                let RBLT: string;
                if (horizontal) {
                    LT = !opposite ? 'left' : 'right';
                    RB = !opposite ? 'right' : 'left';
                    LTRB = !opposite ? 'leftRight' : 'rightLeft';
                    RBLT = !opposite ? 'rightLeft' : 'leftRight';
                }
                else {
                    LT = !opposite ? 'top' : 'bottom';
                    RB = !opposite ? 'bottom' : 'top';
                    LTRB = !opposite ? 'topBottom' : 'bottomTop';
                    RBLT = !opposite ? 'bottomTop' : 'topBottom';
                }
                if ($util.withinRange(node.linear[LT], documentParent.box[LT])) {
                    node.anchor(LT, 'parent', true);
                    return;
                }
                const dimension = node.positionStatic ? 'bounds' : 'linear';
                let beginPercent = 'layout_constraintGuide_';
                let usePercent = false;
                let location: number;
                if (!node.pageFlow && $util.isPercent(node.css(LT))) {
                    location = parseFloat(node.css(LT)) / 100;
                    usePercent = true;
                    beginPercent += 'percent';
                }
                else {
                    if (!percent && !parent.hasAlign($enum.NODE_ALIGNMENT.AUTO_LAYOUT)) {
                        const found = parent.renderChildren.some(item => {
                            if (item !== node && item.constraint[value]) {
                                const pageFlow = node.pageFlow && item.pageFlow;
                                let valid = false;
                                if (pageFlow) {
                                    if ($util.withinRange(node.linear[LT], item.linear[RB])) {
                                        node.anchor(LTRB, item.documentId, true);
                                        valid = true;
                                    }
                                    else if ($util.withinRange(node.linear[RB], item.linear[LT])) {
                                        node.anchor(RBLT, item.documentId, true);
                                        valid = true;
                                    }
                                }
                                if (pageFlow || !node.pageFlow && !item.pageFlow) {
                                    if ($util.withinRange(node.bounds[LT], item.bounds[LT])) {
                                        node.anchor(!horizontal && node.textElement && node.baseline && item.textElement && item.baseline ? 'baseline' : LT, item.documentId, true);
                                        valid = true;
                                    }
                                    else if ($util.withinRange(node.bounds[RB], item.bounds[RB])) {
                                        node.anchor(RB, item.documentId, true);
                                        valid = true;
                                    }
                                }
                                if (valid) {
                                    item.constraint[value] = true;
                                    return true;
                                }
                            }
                            return false;
                        });
                        if (found) {
                            return;
                        }
                    }
                    if (node.positionAuto) {
                        const previousSiblings = node.previousSiblings() as T[];
                        if (previousSiblings.length && !node.alignedVertically(previousSiblings)) {
                            const previous = previousSiblings[previousSiblings.length - 1];
                            if (previous.renderParent === node.renderParent) {
                                node.anchor(horizontal ? 'rightLeft' : 'top', previous.documentId, true);
                                node.constraint[value] = previous.constraint[value];
                                return;
                            }
                        }
                    }
                    if (percent) {
                        const position = Math.abs(node[dimension][LT] - documentParent.box[LT]) / documentParent.box[horizontal ? 'width' : 'height'];
                        location = parseFloat((opposite ? 1 - position : position).toPrecision(this.localSettings.constraint.percentPrecision));
                        usePercent = true;
                        beginPercent += 'percent';
                    }
                    else {
                        location = node[dimension][LT] - documentParent.box[!opposite ? LT : RB];
                        beginPercent += 'begin';
                    }
                }
                const guideline = parent.constraint.guideline || {};
                if (!node.pageFlow) {
                    if (node.absoluteParent === node.documentParent) {
                        location = horizontal ? adjustDocumentRootOffset(location, documentParent, 'Left') : adjustDocumentRootOffset(location, documentParent, 'Top', documentParent.valueBox($enum.BOX_STANDARD.PADDING_TOP)[0] === 1);
                    }
                }
                else {
                    if (node.inlineVertical) {
                        const verticalAlign = $util.convertInt(node.verticalAlign);
                        if (verticalAlign < 0) {
                            location += verticalAlign;
                        }
                    }
                }
                node.constraint[value] = true;
                if (location <= 0) {
                    node.anchor(LT, 'parent', true);
                }
                else if (horizontal && documentParent.hasWidth && !node.has('right') && location + node[dimension].width >= documentParent.box.right || !horizontal && documentParent.hasHeight && !node.has('bottom') && location + node[dimension].height >= documentParent.box.bottom) {
                    node.anchor(RB, 'parent', true);
                }
                else {
                    const anchors = $util.optionalAsObject(guideline, `${value}.${beginPercent}.${LT}`);
                    if (anchors) {
                        for (const id in anchors) {
                            if (parseInt(anchors[id]) === location) {
                                node.anchor(LT, id, true);
                                node.anchorDelete(RB);
                                return;
                            }
                        }
                    }
                    const options = createViewAttribute({
                        android: {
                            orientation: horizontal ? AXIS_ANDROID.VERTICAL : AXIS_ANDROID.HORIZONTAL
                        },
                        app: {
                            [beginPercent]: usePercent ? location.toString() : $util.formatPX(location)
                        }
                    });
                    this.appendAfter(
                        node.id,
                        this.renderNodeStatic(
                            CONTAINER_ANDROID.GUIDELINE,
                            node.renderDepth,
                            options,
                            'wrap_content',
                            'wrap_content'
                        )
                    );
                    const documentId: string = options['documentId'];
                    node.anchor(LT, documentId, true);
                    node.anchorDelete(RB);
                    $util.assignEmptyValue(guideline, value, beginPercent, LT, documentId, location.toString());
                    parent.constraint.guideline = guideline;
                    node.constraint[horizontal ? 'guidelineHorizontal' : 'guidelineVertical'] = documentId;
                }
            }
        });
    }

    public createNodeGroup(node: T, children: T[], parent?: T, replacement?: T) {
        const group = new ViewGroup(this.cache.nextId, node, children, this.afterInsertNode) as T;
        group.siblingIndex = node.siblingIndex;
        if (parent) {
            parent.appendTry(replacement || node, group);
            group.init();
        }
        this.cache.append(group);
        return group;
    }

    public createNodeWrapper(node: T, parent?: T, controlName?: string, containerType?: number) {
        const container = this.application.createNode($element.createElement(node.actualParent ? node.actualParent.element : null, node.block));
        if (node.documentRoot) {
            container.documentRoot = true;
            node.documentRoot = false;
        }
        container.inherit(node, 'base', 'alignment');
        if (controlName) {
            container.setControlType(controlName, containerType);
        }
        container.exclude({
            section: $enum.APP_SECTION.ALL,
            procedure: $enum.NODE_PROCEDURE.CUSTOMIZATION,
            resource: $enum.NODE_RESOURCE.ALL
        });
        container.siblingIndex = node.siblingIndex;
        if (parent) {
            parent.appendTry(node, container);
            node.siblingIndex = 0;
            if (node.renderPosition !== -1) {
                container.renderPositionId = node.renderPositionId;
                node.renderPosition = -1;
            }
            node.parent = container;
        }
        container.saveAsInitial();
        this.application.processing.cache.append(container, !parent);
        node.unsetCache();
        return container;
    }

    protected processRelativeHorizontal(node: T, children: T[]) {
        const cleared = $NodeList.cleared(children);
        const boxWidth = Math.min(
            Math.ceil((() => {
                const renderParent = node.renderParent;
                if (renderParent) {
                    if (renderParent.overflowX) {
                        if (node.has('width', $enum.CSS_STANDARD.LENGTH)) {
                            return node.toFloat('width', true);
                        }
                        else if (renderParent.has('width', $enum.CSS_STANDARD.LENGTH)) {
                            return renderParent.toFloat('width', true);
                        }
                        else if (renderParent.has('width', $enum.CSS_STANDARD.PERCENT)) {
                            return renderParent.actualWidth - renderParent.contentBoxWidth;
                        }
                    }
                    else {
                        let floatStart = Number.NEGATIVE_INFINITY;
                        $util.captureMap(renderParent.children, item => item.float === 'left' && item.siblingIndex < node.siblingIndex, item => floatStart = Math.max(floatStart, item.linear.right));
                        if (floatStart !== Number.NEGATIVE_INFINITY && children.some(item => item.linear.left === floatStart)) {
                            return node.box.right - floatStart;
                        }
                    }
                }
                return node.box.width;
            })()),
            this.userSettings.maxWordWrapWidth
        );
        const checkLineWrap = node.css('whiteSpace') !== 'nowrap';
        const firefoxEdge = $util.isUserAgent($util.USER_AGENT.FIREFOX | $util.USER_AGENT.EDGE);
        const [right, left] = $util.partitionArray(children, item => item.float === 'right');
        const rows: T[][] = [];
        const rangeMultiLine = new Set<T>();
        let alignmentMultiLine = false;
        let rowWidth = 0;
        let rowPreviousLeft: T | undefined;
        let rowPreviousBottom: T | undefined;
        sortHorizontalFloat(left);
        for (const seg of [left, right]) {
            const alignParent = seg === left ? 'left' : 'right';
            for (let i = 0; i < seg.length; i++) {
                const item = seg[i];
                const previous = seg[i - 1];
                let dimension = item.bounds;
                if (item.element && !item.hasWidth && item.inlineText) {
                    const bounds = $dom.getRangeClientRect(item.element);
                    if (bounds.multiline > 0 || bounds.width < item.box.width) {
                        dimension = bounds;
                        if (!item.multiline) {
                            item.multiline = bounds.multiline > 0;
                        }
                        if (firefoxEdge && bounds.multiline && !$util.REGEXP_COMPILED.LEADINGNEWLINE.test(item.textContent)) {
                            rangeMultiLine.add(item);
                        }
                    }
                }
                let alignSibling = seg === left ? 'leftRight' : 'rightLeft';
                let siblings: Element[] | undefined;
                if (i === 0) {
                    item.anchor(alignParent, 'true');
                    rows.push([item]);
                }
                else {
                    function checkWidthWrap() {
                        if (!item.rightAligned) {
                            const baseWidth = (rowPreviousLeft && rows.length > 1 ? rowPreviousLeft.linear.width : 0) + rowWidth + item.marginLeft + (previous.float === 'left' && !cleared.has(item) ? 0 : dimension.width) - (firefoxEdge ? item.borderRightWidth : 0);
                            return Math.floor(baseWidth) - (item.styleElement && item.inlineStatic ? item.paddingLeft + item.paddingRight : 0) > boxWidth;
                        }
                        return false;
                    }
                    if (adjustFloatingNegativeMargin(item, previous)) {
                        alignSibling = '';
                    }
                    const viewGroup = item.groupParent && !item.hasAlign($enum.NODE_ALIGNMENT.SEGMENTED);
                    siblings = !viewGroup && item.element && item.inlineVertical && previous.inlineVertical ? $dom.getElementsBetweenSiblings(previous.element, item.element, true) : undefined;
                    const startNewRow = (() => {
                        if (item.textElement) {
                            if (previous.textElement) {
                                if (i === 1 && siblings === undefined && !previous.rightAligned && item.plainText && !$util.REGEXP_COMPILED.TRAILINGSPACE.test(previous.textContent) && !$util.REGEXP_COMPILED.LEADINGSPACE.test(item.textContent)) {
                                    return false;
                                }
                                else if (checkLineWrap && (rangeMultiLine.has(previous) || previous.multiline && $element.hasLineBreak(<Element> previous.element, false, true))) {
                                    return true;
                                }
                            }
                            if (checkLineWrap && (checkWidthWrap() || item.multiline && $element.hasLineBreak(<Element> item.element) || item.preserveWhiteSpace && $util.REGEXP_COMPILED.LEADINGNEWLINE.test(item.textContent))) {
                                return true;
                            }
                        }
                        return false;
                    })();
                    const rowItems = rows[rows.length - 1];
                    const previousSiblings = item.previousSiblings();
                    if (startNewRow || (
                            viewGroup ||
                            !item.textElement && checkWidthWrap() ||
                            item.linear.top >= previous.linear.bottom && (
                                item.blockStatic ||
                                item.floating && previous.float === item.float
                            ) ||
                            !item.floating && (
                                previous.blockStatic ||
                                previousSiblings.some(sibling => sibling.lineBreak || sibling.excluded && sibling.blockStatic) ||
                                siblings !== undefined && siblings.some(element => $element.isLineBreak(element))
                            ) ||
                            cleared.has(item)
                       ))
                    {
                        rowPreviousBottom = rowItems.find(subitem => !subitem.floating) || rowItems[0];
                        for (let j = 0; j < rowItems.length; j++) {
                            if (rowItems[j] !== rowPreviousBottom && rowItems[j].linear.bottom > rowPreviousBottom.linear.bottom && (!rowItems[j].floating || (rowItems[j].floating && rowPreviousBottom.floating))) {
                                rowPreviousBottom = rowItems[j];
                            }
                        }
                        item.anchor('topBottom', rowPreviousBottom.documentId);
                        if (rowPreviousLeft && item.linear.bottom <= rowPreviousLeft.bounds.bottom) {
                            item.anchor(alignSibling, rowPreviousLeft.documentId);
                        }
                        else {
                            item.anchor(alignParent, 'true');
                            rowPreviousLeft = undefined;
                        }
                        if (startNewRow && item.multiline) {
                            checkSingleLine(previous, checkLineWrap);
                        }
                        rowWidth = Math.min(0, startNewRow && !previous.multiline && item.multiline && !cleared.has(item) ? item.linear.right - node.box.right : 0);
                        rows.push([item]);
                    }
                    else {
                        if (alignSibling !== '') {
                            item.anchor(alignSibling, previous.documentId);
                        }
                        if (rowPreviousBottom) {
                            item.anchor('topBottom', rowPreviousBottom.documentId);
                        }
                        rowItems.push(item);
                    }
                }
                if (item.float === 'left') {
                    rowPreviousLeft = item;
                }
                let previousOffset = 0;
                if (siblings && !siblings.some(element => !!$dom.getElementAsNode(element) || $element.isLineBreak(element))) {
                    const betweenStart = $dom.getRangeClientRect(siblings[0]);
                    const betweenEnd = siblings.length > 1 ? $dom.getRangeClientRect(siblings[siblings.length - 1]) : null;
                    if (!betweenStart.multiline && (betweenEnd === null || !betweenEnd.multiline)) {
                        previousOffset = betweenEnd ? betweenStart.left - betweenEnd.right : betweenStart.width;
                    }
                }
                rowWidth += previousOffset + item.marginLeft + dimension.width + item.marginRight;
                if (i < seg.length - 1 && Math.ceil(rowWidth) >= this.userSettings.maxWordWrapWidth && !item.alignParent(alignParent)) {
                    checkSingleLine(item, checkLineWrap);
                }
            }
        }
        if (rows.length > 1) {
            node.alignmentType |= $enum.NODE_ALIGNMENT.MULTILINE;
            alignmentMultiLine = true;
        }
        for (let i = 0; i < rows.length; i++) {
            let baseline: T | undefined;
            if (rows[i].length > 1) {
                const baselineItems = $NodeList.baseline(rows[i]);
                let textBottom: T | undefined;
                baseline = baselineItems[0];
                if (baseline) {
                    textBottom = getTextBottom(rows[i]);
                    if (textBottom && textBottom.bounds.height > baseline.bounds.height) {
                        baseline.anchor('bottom', textBottom.documentId);
                    }
                    else {
                        textBottom = undefined;
                    }
                }
                const textBaseline = $NodeList.baseline(rows[i], true)[0] as T | undefined;
                const baselineAlign: T[] = [];
                const tryHeight = (child: T) => {
                    if (!alignmentMultiLine) {
                        if (baselineItems.includes(child) || child.actualParent && child.actualHeight >= child.actualParent.box.height) {
                            return true;
                        }
                        else if (!node.hasHeight) {
                            node.css('height', $util.formatPX(node.bounds.height), true);
                        }
                    }
                    return false;
                };
                let documentId = i === 0 ? 'true' : (baseline ? baseline.documentId : '');
                for (const item of rows[i]) {
                    if (item !== baseline) {
                        if (item.baseline) {
                            baselineAlign.push(item);
                        }
                        else if (item.inlineVertical) {
                            switch (item.verticalAlign) {
                                case 'text-top':
                                    if (textBaseline) {
                                        item.anchor('top', textBaseline.documentId);
                                    }
                                    break;
                                case 'super':
                                case 'top':
                                    if (documentId) {
                                        item.anchor('top', documentId);
                                    }
                                    break;
                                case 'middle':
                                    if (!alignmentMultiLine) {
                                        item.anchor('centerVertical', 'true');
                                    }
                                    else if (baseline) {
                                        const height = Math.max(item.actualHeight, item.lineHeight);
                                        const heightParent = Math.max(baseline.actualHeight, baseline.lineHeight);
                                        if (height < heightParent) {
                                            item.anchor('top', baseline.documentId);
                                            item.modifyBox($enum.BOX_STANDARD.MARGIN_TOP, Math.round((heightParent - height) / 2));
                                        }
                                    }
                                    break;
                                case 'text-bottom':
                                    if (textBaseline && item !== textBottom) {
                                        item.anchor('bottom', textBaseline.documentId);
                                    }
                                    break;
                                case 'sub':
                                case 'bottom':
                                    if (tryHeight(item)) {
                                        documentId = '';
                                    }
                                    if (documentId) {
                                        item.anchor('bottom', documentId);
                                    }
                                    break;
                                default:
                                    if (item.verticalAlign !== '0px' && !item.svgElement) {
                                        baselineAlign.push(item);
                                    }
                                    break;
                            }
                        }
                    }
                }
                if (baseline) {
                    baseline.baselineActive = true;
                    if (baselineAlign.length) {
                        adjustBaseline(baseline, baselineAlign);
                    }
                }
            }
            else {
                baseline = rows[i][0];
            }
            if (baseline) {
                setBaselineLineHeight(node, baseline);
            }
        }
    }

    protected processConstraintHorizontal(node: T, children: T[]) {
        const baseline = $NodeList.baseline(children)[0] as T | undefined;
        const baselineText = $NodeList.baseline(children, true)[0] as T | undefined;
        const reverse = node.hasAlign($enum.NODE_ALIGNMENT.RIGHT);
        let textBottom = getTextBottom(children);
        if (baseline) {
            baseline.baselineActive = true;
            if (textBottom && baseline.bounds.height < textBottom.bounds.height) {
                baseline.anchor('bottom', textBottom.documentId);
            }
            else {
                textBottom = undefined;
            }
            setBaselineLineHeight(node, baseline);
        }
        for (let i = 0; i < children.length; i++) {
            const item = children[i];
            const previous = children[i - 1];
            if (i === 0) {
                item.anchor(reverse ? 'right' : 'left', 'parent');
            }
            else if (previous) {
                item.anchor(reverse ? 'rightLeft' : 'leftRight', previous.documentId);
            }
            if (item.inlineVertical) {
                switch (item.verticalAlign) {
                    case 'text-top':
                        if (baselineText && item !== baselineText) {
                            item.anchor('top', baselineText.documentId);
                        }
                        break;
                    case 'super':
                    case 'top':
                        item.anchor('top', 'parent');
                        break;
                    case 'middle':
                        item.anchorParent(AXIS_ANDROID.VERTICAL);
                        break;
                    case 'text-bottom':
                        if (baselineText && item !== baselineText && item !== textBottom) {
                            item.anchor('bottom', baselineText.documentId);
                        }
                        break;
                    case 'sub':
                    case 'bottom':
                        item.anchor('bottom', 'parent');
                        break;
                    case 'baseline':
                        if (baseline && item !== baseline) {
                            item.anchor('baseline', baseline.documentId);
                        }
                        break;
                }
            }
        }
    }

    protected processConstraintColumn(node: T, children: T[]) {
        const columnCount = node.toInt('columnCount');
        const perRowCount = Math.ceil(children.length / Math.min(columnCount, children.length));
        const columns: T[][] = [];
        let totalGap = 0;
        for (let i = 0, j = 0; i < children.length; i++) {
            const item = children[i];
            if (i % perRowCount === 0) {
                if (i > 0) {
                    j++;
                }
                if (columns[j] === undefined) {
                    columns[j] = [];
                }
            }
            columns[j].push(item);
            if (item.length) {
                totalGap += $math.maxArray($util.objectMap<T, number>(item.children as T[], child => child.marginLeft + child.marginRight));
            }
        }
        const columnGap = $util.convertInt(node.css('columnGap')) || 16;
        const percentGap = Math.max(((totalGap + (columnGap * (columnCount - 1))) / node.box.width) / columnCount, 0.01);
        const chainHorizontal: T[][] = [];
        const chainVertical: T[][] = [];
        const columnStart: T[] = [];
        for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const first = column[0];
            if (i > 0) {
                first.android(first.localizeString(BOX_ANDROID.MARGIN_LEFT), $util.formatPX(first.marginLeft + columnGap));
            }
            columnStart.push(first);
            for (const item of column) {
                let percent = 0;
                if (item.has('width', $enum.CSS_STANDARD.PERCENT)) {
                    percent = item.toInt('width') / 100;
                }
                else {
                    percent = (1 / columnCount) - percentGap;
                }
                if (percent > 0) {
                    item.android('layout_width', '0px');
                    item.app('layout_constraintWidth_percent', percent.toPrecision(this.localSettings.constraint.percentPrecision));
                }
            }
            chainVertical.push(column);
        }
        chainHorizontal.push(columnStart);
        createColumnLayout(chainHorizontal, true);
        createColumnLayout(chainVertical, false);
    }

    protected processConstraintChain(node: T, children: T[], bottomParent: number) {
        const chainHorizontal = $NodeList.partitionRows(children);
        const parent = $NodeList.actualParent(children) || node;
        const floating = node.hasAlign($enum.NODE_ALIGNMENT.FLOAT);
        const cleared = chainHorizontal.length > 1 && node.hasAlign($enum.NODE_ALIGNMENT.NOWRAP) ? $NodeList.clearedAll(parent) : new Map<T, string>();
        let reverse = false;
        if (chainHorizontal.length > 1) {
            node.alignmentType |= $enum.NODE_ALIGNMENT.MULTILINE;
        }
        if (floating) {
            reverse = node.hasAlign($enum.NODE_ALIGNMENT.RIGHT);
            if (children.some(item => item.has('width', $enum.CSS_STANDARD.PERCENT))) {
                node.android('layout_width', 'match_parent');
            }
        }
        for (const item of children) {
            if (!floating) {
                if (item.rightAligned) {
                    if ($util.withinRange(item.linear.right, parent.box.right) || item.linear.right > parent.box.right) {
                        item.anchor('right', 'parent');
                    }
                }
                else if ($util.withinRange(item.linear.left, parent.box.left) || item.linear.left < parent.box.left) {
                    item.anchor('left', 'parent');
                }
            }
            if ($util.withinRange(item.linear.top, node.box.top) || item.linear.top < node.box.top || item.floating && chainHorizontal.length === 1) {
                item.anchor('top', 'parent');
            }
            if (this.withinParentBottom(item.linear.bottom, bottomParent) && !parent.documentBody && (parent.hasHeight || !item.alignParent('top'))) {
                item.anchor('bottom', 'parent');
            }
        }
        const previousSiblings: T[] = [];
        let anchorStart: string;
        let anchorEnd: string;
        let chainStart: string;
        let chainEnd: string;
        if (reverse) {
            anchorStart = 'right';
            anchorEnd = 'left';
            chainStart = 'rightLeft';
            chainEnd = 'leftRight';
        }
        else {
            anchorStart = 'left';
            anchorEnd = 'right';
            chainStart = 'leftRight';
            chainEnd = 'rightLeft';
        }
        for (let i = 0; i < chainHorizontal.length; i++) {
            const seg = chainHorizontal[i];
            const rowStart = seg[0];
            const rowEnd = seg[seg.length - 1];
            rowStart.anchor(anchorStart, 'parent');
            if (parent.css('textAlign') === 'center') {
                rowStart.app('layout_constraintHorizontal_chainStyle', 'spread');
            }
            else if (seg.length > 1) {
                if (reverse) {
                    rowEnd.app('layout_constraintHorizontal_chainStyle', 'packed');
                    rowEnd.app('layout_constraintHorizontal_bias', '1');
                }
                else {
                    rowStart.app('layout_constraintHorizontal_chainStyle', 'packed');
                    rowStart.app('layout_constraintHorizontal_bias', '0');
                }
            }
            if (seg.length > 1) {
                rowEnd.anchor(anchorEnd, 'parent');
            }
            let previousRowBottom: T | undefined;
            if (i > 0) {
                const previousRow = chainHorizontal[i - 1];
                previousRowBottom = previousRow[0];
                for (let j = 1; j < previousRow.length; j++) {
                    if (previousRow[j].linear.bottom > previousRowBottom.linear.bottom) {
                        previousRowBottom = previousRow[j];
                    }
                }
            }
            for (let j = 0; j < seg.length; j++) {
                const chain = seg[j];
                const previous = seg[j - 1];
                const next = seg[j + 1];
                if (chain.autoMargin.leftRight) {
                    chain.anchorParent(AXIS_ANDROID.HORIZONTAL);
                }
                else {
                    if (previous) {
                        chain.anchor(chainStart, previous.documentId);
                    }
                    if (next) {
                        chain.anchor(chainEnd, next.documentId);
                    }
                }
                Controller.setConstraintDimension(chain);
                if (i > 0) {
                    const previousRow = chainHorizontal[i - 1];
                    const aboveEnd = previousRow[previousRow.length - 1];
                    const previousEnd = reverse ? rowEnd : rowStart;
                    const nodes: T[] = [];
                    if (aboveEnd) {
                        nodes.push(aboveEnd);
                        if (chain.element) {
                            const elements = $dom.getElementsBetweenSiblings(aboveEnd.element, chain.element);
                            if (elements) {
                                $util.concatArray(nodes, $util.flatMap(elements, element => $dom.getElementAsNode<T>(element) as T));
                            }
                        }
                    }
                    else {
                        nodes.push(previousEnd);
                    }
                    if (floating && (cleared.size === 0 || !nodes.some(item => cleared.has(item)))) {
                        if (previousRow.length) {
                            chain.anchor('topBottom', aboveEnd.documentId);
                            if (aboveEnd.alignSibling('bottomTop') === '') {
                                aboveEnd.anchor('bottomTop', chain.documentId);
                            }
                            for (let k = previousSiblings.length - 2; k >= 0; k--) {
                                const aboveBefore = previousSiblings[k];
                                if (aboveBefore.linear.bottom > aboveEnd.linear.bottom) {
                                    const offset = reverse ? Math.ceil(aboveBefore.linear[anchorEnd]) - Math.floor(parent.box[anchorEnd]) : Math.ceil(parent.box[anchorEnd]) - Math.floor(aboveBefore.linear[anchorEnd]);
                                    if (offset >= chain.linear.width) {
                                        chain.anchor(chainStart, aboveBefore.documentId);
                                        chain.anchorDelete(chainEnd);
                                        if (chain === rowStart) {
                                            chain.anchorDelete(anchorStart);
                                            chain.delete('app', 'layout_constraintHorizontal_chainStyle', 'layout_constraintHorizontal_bias');
                                        }
                                        else if (chain === rowEnd) {
                                            chain.anchorDelete(anchorEnd);
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    else if (previousRowBottom) {
                        if (j > 0) {
                            chain.anchor('top', rowStart.documentId);
                            chain.modifyBox($enum.BOX_STANDARD.MARGIN_TOP, rowStart.marginTop * -1);
                        }
                        else {
                            chain.anchor('topBottom', previousRowBottom.documentId);
                            previousRowBottom.anchor('bottomTop', chain.documentId);
                        }
                    }
                }
                previousSiblings.push(chain);
            }
        }
        Controller.evaluateAnchors(children);
    }

    private withinParentBottom(bottom: number, boxBottom: number) {
        return $util.withinRange(bottom, boxBottom, this.localSettings.constraint.withinParentBottomOffset);
    }

    get userSettings() {
        return this.application.userSettings as UserSettingsAndroid;
    }

    get containerTypeHorizontal(): LayoutType {
        return {
            containerType: CONTAINER_NODE.LINEAR,
            alignmentType: $enum.NODE_ALIGNMENT.HORIZONTAL,
            renderType: 0
        };
    }

    get containerTypeVertical(): LayoutType {
        return {
            containerType: CONTAINER_NODE.LINEAR,
            alignmentType: $enum.NODE_ALIGNMENT.VERTICAL,
            renderType: 0
        };
    }

    get containerTypeVerticalMargin(): LayoutType {
        return {
            containerType: CONTAINER_NODE.FRAME,
            alignmentType: $enum.NODE_ALIGNMENT.COLUMN,
            renderType: 0
        };
    }

    get afterInsertNode(): BindGeneric<T, void> {
        const settings = this.userSettings;
        return (target: T) => {
            target.localSettings = {
                targetAPI: settings.targetAPI !== undefined ? settings.targetAPI : BUILD_ANDROID.LATEST,
                supportRTL: settings.supportRTL !== undefined ? settings.supportRTL : true,
                floatPrecision: this.localSettings.floatPrecision,
                constraintPercentPrecision: this.localSettings.constraint.percentPrecision
            };
        };
    }
}