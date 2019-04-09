import { CONTAINER_ANDROID } from '../../lib/constant';
import { CONTAINER_NODE } from '../../lib/enumeration';

import $Layout = squared.base.Layout;

const $enum = squared.base.lib.enumeration;
const $util = squared.lib.util;

export default class MaxWidthHeight<T extends android.base.View> extends squared.base.Extension<T> {
    public condition(node: T, parent: T) {
        return !node.textElement && !node.imageElement && !node.svgElement && (
            node.has('maxWidth') && !parent.has('columnCount') && !parent.has('columnWidth') ||
            node.has('maxHeight') ||
            this.application.userSettings.supportNegativeLeftTop && node.some(item => !item.pageFlow && !item.imageElement && item.actualParent === node && (item.left < 0 || item.right < 0))
        );
    }

    public processNode(node: T, parent: T) {
        const absolute = node.filter(item => !item.pageFlow);
        let container: T;
        let left = NaN;
        let right = NaN;
        let complete = false;
        if (absolute.length) {
            container = (<android.base.Controller<T>> this.application.controllerHandler).createNodeWrapper(node, parent, absolute as T[], CONTAINER_ANDROID.CONSTRAINT, CONTAINER_NODE.CONSTRAINT);
            if (this.application.userSettings.supportNegativeLeftTop) {
                for (const item of absolute) {
                    if (item.actualParent === node) {
                        if (item.left < 0 && (isNaN(left) || item.linear.left < left)) {
                            left = item.linear.left;
                        }
                        if (item.right < 0 && (isNaN(right) || item.linear.right > right)) {
                            right = item.linear.right;
                        }
                    }
                }
            }
        }
        else {
            container = (<android.base.Controller<T>> this.application.controllerHandler).createNodeWrapper(node, parent, undefined, CONTAINER_ANDROID.FRAME, CONTAINER_NODE.FRAME);
        }
        container.cssApply({
            marginTop: '0px',
            marginRight: '0px',
            marginBottom: '0px',
            marginLeft: '0px',
            paddingTop: '0px',
            paddingRight: '0px',
            paddingBottom: '0px',
            paddingLeft: '0px',
            borderTopStyle: 'none',
            borderRightStyle: 'none',
            borderBottomStyle: 'none',
            borderLeftStyle: 'none',
            borderRadius: '0px',
            display: 'block'
        });
        container.inherit(node, 'styleMap');
        const maxWidth = node.css('maxWidth');
        if ($util.isLength(maxWidth, true)) {
            container.css('width', $util.formatPX(node.parseUnit(maxWidth) + ($util.isPercent(maxWidth) ? 0 : node.contentBoxWidth + (node.marginLeft > 0 ? node.marginLeft : 0) + (node.marginRight > 0 ? node.marginRight : 0))));
            if (container.documentRoot || parent.flexElement || parent.gridElement) {
                node.autoMargin.horizontal = false;
                node.autoMargin.left = false;
                node.autoMargin.right = false;
                node.autoMargin.leftRight = false;
            }
        }
        const maxHeight = node.css('maxHeight');
        if ($util.isLength(maxHeight, true)) {
            container.css('height', $util.formatPX(node.parseUnit(maxHeight) + ($util.isPercent(maxHeight) ? 0 : node.contentBoxHeight + (node.marginTop > 0 ? node.marginTop : 0) + (node.marginBottom > 0 ? node.marginBottom : 0))));
            if (container.documentRoot || parent.flexElement || parent.gridElement) {
                node.autoMargin.vertical = false;
                node.autoMargin.top = false;
                node.autoMargin.bottom = false;
                node.autoMargin.topBottom = false;
            }
        }
        if (!isNaN(left)) {
            const offset = node.linear.left - left;
            if (offset > 0) {
                node.modifyBox($enum.BOX_STANDARD.MARGIN_LEFT, offset);
                for (const item of absolute) {
                    if (item.actualParent === node && item.left < 0) {
                        item.css('left', $util.formatPX(item.left + offset), true);
                    }
                }
                complete = true;
            }
        }
        if (!isNaN(right)) {
            const offset = right - node.linear.right;
            if (offset > 0) {
                node.modifyBox($enum.BOX_STANDARD.MARGIN_RIGHT, offset);
                for (const item of absolute) {
                    if (item.actualParent === node && item.right < 0) {
                        item.css('right', $util.formatPX(item.right + offset), true);
                    }
                }
                complete = true;
            }
        }
        return {
            parent: container,
            renderAs: container,
            outputAs: this.application.renderNode(
                new $Layout(
                    parent,
                    container,
                    container.containerType,
                    $enum.NODE_ALIGNMENT.SINGLE,
                    container.children as T[]
                )
            ),
            complete
        };
    }
}