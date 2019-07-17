import View from '../../view';

import { CONTAINER_NODE } from '../../lib/enumeration';

import $LayoutUI = squared.base.LayoutUI;

const $e = squared.base.lib.enumeration;

export default class NegativeViewport<T extends View> extends squared.base.ExtensionUI<T> {
    public is(node: T) {
        return !node.pageFlow;
    }

    public condition(node: T, parent: T) {
        return parent.naturalElement && parent.documentRoot && (
            Math.ceil(node.linear.left) < Math.floor(parent.box.left) && (node.left < 0 || node.marginLeft < 0 || !node.hasPX('left') && node.right > 0) ||
            Math.floor(node.linear.right) > Math.ceil(parent.box.right) && (node.left > 0 || node.marginLeft > 0 || !node.hasPX('left') && node.right < 0) ||
            Math.ceil(node.linear.top) < Math.floor(parent.box.top) && (node.top < 0 || node.marginTop < 0 || !node.hasPX('top') && node.bottom > 0) ||
            Math.floor(node.linear.bottom) > Math.ceil(parent.box.bottom) && (node.top > 0 || node.marginTop > 0 || !node.hasPX('top') && node.bottom < 0) && parent.hasPX('height')
        );
    }

    public processNode(node: T, parent: T) {
        const container = (<android.base.Controller<T>> this.controller).createNodeWrapper(node, parent);
        return {
            parent: container,
            renderAs: container,
            outputAs: this.application.renderNode(
                new $LayoutUI(
                    parent,
                    container,
                    CONTAINER_NODE.FRAME,
                    $e.NODE_ALIGNMENT.SINGLE,
                    container.children as T[]
                )
            ),
            include: true
        };
    }
}