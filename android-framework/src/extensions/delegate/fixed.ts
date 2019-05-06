import View from '../../view';

import { EXT_ANDROID } from '../../lib/constant';
import { CONTAINER_NODE } from '../../lib/enumeration';

import $Layout = squared.base.Layout;

type FixedData = {
    fixedRight: boolean;
    fixedBottom: boolean;
};

const $enum = squared.base.lib.enumeration;
const $util = squared.lib.util;

const getFixedNodes = (node: View) => node.filter(item => !item.pageFlow && item.leftTopAxis);

const withinBoxRegion = (rect: number[], value: number) => rect.some(coord => coord < value);

export default class Fixed<T extends View> extends squared.base.Extension<T> {
    public condition(node: T) {
        if (node.naturalElement && (node.documentBody || node.contentBoxWidth > 0 || node.contentBoxHeight > 0)) {
            const fixed = getFixedNodes(node);
            if (fixed.length) {
                const top: number[] = [];
                const right: number[] = [];
                const bottom: number[] = [];
                const left: number[] = [];
                let fixedRight = false;
                let fixedBottom = false;
                for (const item of fixed) {
                    if (item.has('top')) {
                        if (node.paddingTop > 0 && item.top >= 0) {
                            top.push(item.top);
                        }
                    }
                    else if (node.paddingBottom > 0 && item.bottom >= 0 && item.has('bottom')) {
                        bottom.push(item.bottom);
                        if (item.position === 'fixed') {
                            fixedBottom = true;
                        }
                    }
                    if (item.has('left')) {
                        if (node.paddingLeft > 0 && item.left >= 0) {
                            left.push(item.left);
                        }
                    }
                    else if (node.paddingRight > 0 && item.right >= 0 && item.has('right')) {
                        right.push(item.right);
                        if (item.position === 'fixed') {
                            fixedRight = true;
                        }
                    }
                }
                if (withinBoxRegion(top, node.paddingTop + (node.documentBody ? node.marginTop : 0)) ||
                    withinBoxRegion(right, node.paddingRight + (node.documentBody ? node.marginRight : 0)) ||
                    withinBoxRegion(bottom, node.paddingBottom + (node.documentBody ? node.marginBottom : 0)) ||
                    withinBoxRegion(left, node.paddingLeft + (node.documentBody ? node.marginLeft : 0)) ||
                    node.documentBody && (right.length && node.has('width') || bottom.length && node.has('height')))
                {
                    if (node.documentBody) {
                        node.data(EXT_ANDROID.DELEGATE_FIXED, 'mainData', <FixedData> { fixedRight, fixedBottom });
                    }
                    return true;
                }
            }
        }
        return false;
    }

    public processNode(node: T, parent: T) {
        const [children, nested] = $util.partitionArray(getFixedNodes(node), item => item.absoluteParent === node) as [T[], T[]];
        $util.concatArray($util.sortArray(children, true, 'zIndex', 'siblingIndex'), $util.sortArray(nested, true, 'zIndex', 'siblingIndex'));
        nested.length = 0;
        for (const item of node.duplicate() as T[]) {
            if (!children.includes(item)) {
                nested.push(item);
            }
        }
        if (nested.length) {
            const container = this.application.controllerHandler.createNodeGroup(nested[0], nested, node);
            container.inherit(node, 'initial', 'base');
            container.exclude({
                procedure: $enum.NODE_PROCEDURE.NONPOSITIONAL,
                resource: $enum.NODE_RESOURCE.BOX_STYLE | $enum.NODE_RESOURCE.ASSET
            });
            if (node.documentBody) {
                const mainData: FixedData = node.data(EXT_ANDROID.DELEGATE_FIXED, 'mainData');
                if (mainData && (mainData.fixedRight || mainData.fixedBottom)) {
                    if (node.has('width')) {
                        container.css('width', node.css('width'));
                    }
                    if (node.has('height')) {
                        container.css('height', node.css('height'));
                    }
                    node.cssApply({
                        display: 'block',
                        width: 'auto',
                        height: 'auto',
                        float: 'none'
                    }, true);
                    if (mainData.fixedRight) {
                        node.android('layout_width', 'match_parent');
                    }
                    if (mainData.fixedBottom) {
                        node.android('layout_height', 'match_parent');
                    }
                }
            }
            container.outerWrapper = node;
            children.push(container);
            node.retain(children);
            node.resetBox($enum.BOX_STANDARD.PADDING | (node.documentBody ? $enum.BOX_STANDARD.MARGIN : 0), container, true);
            node.innerWrapped = container;
            return {
                output: this.application.renderNode(
                    new $Layout(
                        parent,
                        node,
                        CONTAINER_NODE.CONSTRAINT,
                        $enum.NODE_ALIGNMENT.ABSOLUTE,
                        children
                    )
                )
            };
        }
        return undefined;
    }

    public postBaseLayout(node: T) {
        if (node.hasWidth && node.outerWrapper && node.documentBody && node.some(item => item.has('right'))) {
            const width = node.cssInitial('width', true);
            const minWidth = node.cssInitial('minWidth', true);
            node.cssApply({ width: 'auto', minWidth: 'auto' }, true);
            node.outerWrapper.cssApply({ width, minWidth }, true);
            node.android('layout_width', 'match_parent');
        }
    }
}