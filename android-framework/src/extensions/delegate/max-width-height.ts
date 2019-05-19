import { CONTAINER_ANDROID, EXT_ANDROID, STRING_ANDROID } from '../../lib/constant';
import { CONTAINER_NODE } from '../../lib/enumeration';

import $Layout = squared.base.Layout;

export interface MaxWidthHeightData {
    width: boolean;
    height: boolean;
    container?: View;
}

type View = android.base.View;

const $const = squared.lib.constant;
const $c = squared.base.lib.constant;
const $e = squared.base.lib.enumeration;

export default class MaxWidthHeight<T extends View> extends squared.base.Extension<T> {
    public condition(node: T, parent: T) {
        let width = false;
        let height = false;
        if (!node.support.maxWidth && !isNaN(node.width) && node.has('maxWidth') && !parent.hasAlign($e.NODE_ALIGNMENT.COLUMN)) {
            const blockWidth = node.css($const.CSS.WIDTH) === $const.CSS.PERCENT_100;
            if (node.width === 0 || blockWidth) {
                if (node.blockStatic && !node.autoMargin.horizontal || blockWidth) {
                    node.css($const.CSS.WIDTH, node.css('maxWidth'));
                }
                else {
                    width = true;
                }
            }
            else {
                width = true;
            }
        }
        if (!node.support.maxHeight && !isNaN(node.height) && node.has('maxHeight') && parent.hasHeight) {
            if (node.hasHeight && node.css($const.CSS.HEIGHT) === $const.CSS.PERCENT_100) {
                node.css($const.CSS.HEIGHT, node.css('maxHeight'));
            }
            else {
                height = true;
            }
        }
        if (width || height) {
            node.data(EXT_ANDROID.DELEGATE_MAXWIDTHHEIGHT, $c.STRING_BASE.EXT_DATA, <MaxWidthHeightData> { width, height });
            return true;
        }
        return false;
    }

    public processNode(node: T, parent: T) {
        const mainData: MaxWidthHeightData = node.data(EXT_ANDROID.DELEGATE_MAXWIDTHHEIGHT, $c.STRING_BASE.EXT_DATA);
        if (mainData) {
            const container = parent.layoutConstraint ? parent : (<android.base.Controller<T>> this.application.controllerHandler).createNodeWrapper(node, parent, undefined, CONTAINER_ANDROID.CONSTRAINT, CONTAINER_NODE.CONSTRAINT);
            if (mainData.width) {
                node.setLayoutWidth($const.CSS.PX_ZERO);
                container.setLayoutWidth(STRING_ANDROID.MATCH_PARENT);
                if (parent.layoutElement) {
                    node.autoMargin.horizontal = false;
                    node.autoMargin.left = false;
                    node.autoMargin.right = false;
                    node.autoMargin.leftRight = false;
                }
            }
            if (mainData.height) {
                node.setLayoutHeight($const.CSS.PX_ZERO);
                container.setLayoutHeight(STRING_ANDROID.MATCH_PARENT);
                if (parent.layoutElement) {
                    node.autoMargin.vertical = false;
                    node.autoMargin.top = false;
                    node.autoMargin.bottom = false;
                    node.autoMargin.topBottom = false;
                }
            }
            mainData.container = container;
            if (parent !== container) {
                return {
                    parent: container,
                    renderAs: container,
                    outputAs: this.application.renderNode(
                        new $Layout(
                            parent,
                            container,
                            container.containerType,
                            $e.NODE_ALIGNMENT.SINGLE,
                            container.children as T[]
                        )
                    )
                };
            }
        }
        return undefined;
    }
}