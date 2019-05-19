import { NodeXmlTemplate } from '../../src/base/@types/application';

import { WIDGET_NAME } from '../lib/constant';

import $Resource = android.base.Resource;

const $const = squared.lib.constant;
const $color = squared.lib.color;
const $util = squared.lib.util;
const $constA = android.lib.constant;
const $enumA = android.lib.enumeration;
const $utilA = android.lib.util;
const $e = squared.base.lib.enumeration;

const PREFIX_DIALOG = 'ic_dialog_';

export default class FloatingActionButton<T extends android.base.View> extends squared.base.Extension<T> {
    public is(node: T) {
        const element = <HTMLInputElement> node.element;
        return super.is(node) && (element.tagName !== 'INPUT' || ['button', 'file', 'image', 'reset', 'search', 'submit'].includes(element.type));
    }

    public condition(node: T) {
        return this.included(<HTMLElement> node.element);
    }

    public processNode(node: T, parent: T) {
        const resource = <android.base.Resource<T>> this.application.resourceHandler;
        const element = <HTMLElement> node.element;
        const target = node.dataset.target;
        const options = $utilA.createViewAttribute(this.options[element.id]);
        const colorName = $Resource.addColor($color.parseColor(node.css('backgroundColor'), node.css('opacity')));
        $util.assignEmptyValue(options, $constA.STRING_ANDROID.ANDROID, 'backgroundTint', colorName !== '' ? `@color/${colorName}` : '?attr/colorAccent');
        if (!node.hasProcedure($e.NODE_PROCEDURE.ACCESSIBILITY)) {
            $util.assignEmptyValue(options, $constA.STRING_ANDROID.ANDROID, 'focusable', 'false');
        }
        let src = '';
        switch (element.tagName) {
            case 'IMG':
                src = resource.addImageSrc(<HTMLImageElement> element, PREFIX_DIALOG);
                break;
            case 'INPUT':
                if ((<HTMLInputElement> element).type === 'image') {
                    src = resource.addImageSrc(<HTMLImageElement> element, PREFIX_DIALOG);
                    break;
                }
            case 'BUTTON':
                src = resource.addImageSrc(node.backgroundImage, PREFIX_DIALOG);
                break;
        }
        if (src !== '') {
            $util.assignEmptyValue(options, $constA.STRING_ANDROID.APP, 'srcCompat', `@drawable/${src}`);
        }
        node.setControlType($constA.SUPPORT_ANDROID.FLOATING_ACTION_BUTTON, $enumA.CONTAINER_NODE.BUTTON);
        node.exclude({ resource: $e.NODE_RESOURCE.BOX_STYLE | $e.NODE_RESOURCE.ASSET });
        $Resource.formatOptions(options, this.application.extensionManager.optionValueAsBoolean($constA.EXT_ANDROID.RESOURCE_STRINGS, 'numberResourceValue'));
        let parentAs: T | undefined;
        if (!node.pageFlow || target) {
            const horizontalBias = $utilA.getHorizontalBias(node);
            const verticalBias = $utilA.getVerticalBias(node);
            const documentParent = node.documentParent;
            const gravity: string[] = [];
            if (horizontalBias < 0.5) {
                gravity.push(node.localizeString($const.CSS.LEFT));
            }
            else if (horizontalBias > 0.5) {
                gravity.push(node.localizeString($const.CSS.RIGHT));
            }
            else {
                gravity.push($constA.STRING_ANDROID.CENTER_HORIZONTAL);
            }
            if (verticalBias < 0.5) {
                gravity.push($const.CSS.TOP);
                node.app('layout_dodgeInsetEdges', $const.CSS.TOP);
            }
            else if (verticalBias > 0.5) {
                gravity.push($const.CSS.BOTTOM);
            }
            else {
                gravity.push($constA.STRING_ANDROID.CENTER_VERTICAL);
            }
            for (const value of gravity) {
                node.mergeGravity($constA.STRING_ANDROID.LAYOUT_GRAVITY, value);
            }
            if (horizontalBias > 0 && horizontalBias < 1 && horizontalBias !== 0.5) {
                if (horizontalBias < 0.5) {
                    node.modifyBox($e.BOX_STANDARD.MARGIN_LEFT, node.linear.left - documentParent.box.left);
                }
                else {
                    node.modifyBox($e.BOX_STANDARD.MARGIN_RIGHT, documentParent.box.right - node.linear.right);
                }
            }
            if (verticalBias > 0 && verticalBias < 1 && verticalBias !== 0.5) {
                if (verticalBias < 0.5) {
                    node.modifyBox($e.BOX_STANDARD.MARGIN_TOP, node.linear.top - documentParent.box.top);
                }
                else {
                    node.modifyBox($e.BOX_STANDARD.MARGIN_BOTTOM, documentParent.box.bottom - node.linear.bottom);
                }
            }
            node.positioned = true;
            if (target) {
                const layoutGravity = node.android($constA.STRING_ANDROID.LAYOUT_GRAVITY);
                let anchor = parent.documentId;
                if (parent.controlName === $constA.SUPPORT_ANDROID.TOOLBAR) {
                    const outerParent: string = parent.data(WIDGET_NAME.TOOLBAR, 'outerParent');
                    if (outerParent) {
                        anchor = outerParent;
                    }
                }
                if (layoutGravity !== '') {
                    node.app('layout_anchorGravity', layoutGravity);
                    node.delete($constA.STRING_ANDROID.ANDROID, $constA.STRING_ANDROID.LAYOUT_GRAVITY);
                }
                node.app('layout_anchor', anchor);
                node.exclude({ procedure: $e.NODE_PROCEDURE.ALIGNMENT });
                node.render(this.application.resolveTarget(target));
                parentAs = node.renderParent as T;
            }
        }
        if (!target) {
            node.render(parent);
        }
        node.apply(options);
        return {
            parentAs,
            output: <NodeXmlTemplate<T>> {
                type: $e.NODE_TEMPLATE.XML,
                node,
                controlName: $constA.SUPPORT_ANDROID.FLOATING_ACTION_BUTTON
            },
            complete: true
        };
    }
}