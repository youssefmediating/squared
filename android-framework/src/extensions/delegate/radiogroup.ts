import { NodeXmlTemplate } from '../../../../src/base/@types/application';

import View from '../../view';

import { CONTAINER_ANDROID, STRING_ANDROID } from '../../lib/constant';
import { CONTAINER_NODE } from '../../lib/enumeration';

import $NodeUI = squared.base.NodeUI;

const $const = squared.lib.constant;
const $e = squared.base.lib.enumeration;

const getInputName = (element: HTMLInputElement) => element.name ? element.name.trim() : '';

export default class RadioGroup<T extends View> extends squared.base.ExtensionUI<T> {
    public condition(node: T) {
        if (node.length) {
            if (node.inputContainer && node.length > 1) {
                const inputName = new Set<string>();
                let i = 0;
                let valid = true;
                for (let item of node.children as T[]) {
                    if (!item.baseline || item.multiline) {
                        valid = false;
                        break;
                    }
                    if (item.renderAs) {
                        item = item.renderAs as T;
                    }
                    if (item.is(CONTAINER_NODE.RADIO)) {
                        const name = getInputName(<HTMLInputElement> item.element);
                        if (name !== '') {
                            inputName.add(name);
                            i++;
                        }
                    }
                }
                if (valid && i > 1 && inputName.size === 1) {
                    const data = $NodeUI.linearData(node.children);
                    return data.linearX && !data.floated.has($const.CSS.RIGHT);
                }
            }
            return false;
        }
        else {
            return node.is(CONTAINER_NODE.RADIO) && getInputName(<HTMLInputElement> node.element) !== '' && !node.positioned;
        }
    }

    public processNode(node: T, parent: T) {
        const controlName = CONTAINER_ANDROID.RADIOGROUP;
        if (node.inputContainer) {
            node.setControlType(controlName, CONTAINER_NODE.LINEAR);
            node.addAlign($e.NODE_ALIGNMENT.HORIZONTAL);
            node.android('orientation', STRING_ANDROID.HORIZONTAL);
            if (node.baseline) {
                node.css('verticalAlign', 'middle', true);
                node.baseline = false;
            }
            node.render(parent);
            return {
                output: <NodeXmlTemplate<T>> {
                    type: $e.NODE_TEMPLATE.XML,
                    node,
                    controlName
                },
                complete: true
            };
        }
        else if (parent.controlName !== controlName) {
            const element = <HTMLInputElement> node.element;
            const inputName = getInputName(element);
            const children: T[] = [];
            const removeable: T[] = [];
            parent.each((item: T) => {
                let remove: T | undefined;
                if (item.renderAs) {
                    if (item.renderAs !== node) {
                        remove = item;
                    }
                    item = item.renderAs as T;
                }
                if (node.is(CONTAINER_NODE.RADIO) && getInputName(<HTMLInputElement> item.element) === inputName && !item.rendered) {
                    children.push(item);
                    if (remove) {
                        removeable.push(remove);
                    }
                }
            });
            if (children.length > 1) {
                const container = this.application.controllerHandler.createNodeGroup(node, children, parent, true);
                container.addAlign($e.NODE_ALIGNMENT.HORIZONTAL | (parent.length !== children.length ? $e.NODE_ALIGNMENT.SEGMENTED : 0));
                if (parent.layoutConstraint) {
                    container.companion = node;
                }
                container.setControlType(controlName, CONTAINER_NODE.LINEAR);
                container.inherit(node, 'alignment');
                if (container.baseline) {
                    container.css('verticalAlign', 'middle');
                    container.baseline = false;
                }
                container.exclude($e.NODE_RESOURCE.ASSET);
                container.each((item: T) => {
                    if (item !== node) {
                        item.setControlType(CONTAINER_ANDROID.RADIO, CONTAINER_NODE.RADIO);
                    }
                });
                container.render(!node.dataset.use && node.dataset.target ? this.application.resolveTarget(node.dataset.target) : parent);
                container.android('orientation', $NodeUI.linearData(children).linearX ? STRING_ANDROID.HORIZONTAL : STRING_ANDROID.VERTICAL);
                for (const item of removeable) {
                    item.hide();
                }
                this.subscribers.add(container);
                return {
                    renderAs: container,
                    outputAs: <NodeXmlTemplate<T>> {
                        type: $e.NODE_TEMPLATE.XML,
                        node: container,
                        controlName
                    },
                    parent: container,
                    complete: true
                };
            }
        }
        return undefined;
    }

    public postBaseLayout(node: T) {
        node.renderEach((item: T) => {
            if (item.naturalElement && (<HTMLInputElement> item.element).checked) {
                node.android('checkedButton', item.documentId);
            }
        });
    }
}