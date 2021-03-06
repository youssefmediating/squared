import ExtensionUI from '../extension-ui';
import LayoutUI from '../layout-ui';
import NodeUI from '../node-ui';

import { BOX_STANDARD } from '../lib/enumeration';

const $lib = squared.lib;
const { assignRect } = $lib.dom;
const { convertFloat, filterArray, withinRange } = $lib.util;

export default abstract class Relative<T extends NodeUI> extends ExtensionUI<T> {
    public is(node: T) {
        return node.positionRelative || node.toFloat('verticalAlign', true) !== 0;
    }

    public condition() {
        return true;
    }

    public processNode() {
        return { include: true };
    }

    public postOptimize(node: T) {
        const renderParent = node.renderParent as T;
        const verticalAlign = convertFloat(node.verticalAlign);
        let { top, right, bottom, left } = node;
        let target = node;
        if (renderParent.support.container.positionRelative && renderParent.layoutHorizontal && node.renderChildren.length === 0 && (node.top !== 0 || node.bottom !== 0 || verticalAlign !== 0)) {
            const application = this.application;
            target = node.clone(application.nextId, true, true) as T;
            target.baselineAltered = true;
            node.hide(true);
            application.session.cache.append(target, false);
            const layout = new LayoutUI(
                renderParent,
                target,
                target.containerType,
                target.alignmentType
            );
            const index = renderParent.renderChildren.findIndex(item => item === node);
            if (index !== -1) {
                layout.renderIndex = index + 1;
            }
            application.addLayout(layout);
            if (renderParent.layoutHorizontal && node.documentParent.parseUnit(node.css('textIndent')) < 0) {
                renderParent.renderEach(item => {
                    const documentId = node.documentId;
                    if (item.alignSibling('topBottom') === documentId) {
                        item.alignSibling('topBottom', target.documentId);
                    }
                    else if (item.alignSibling('bottomTop') === documentId) {
                        item.alignSibling('bottomTop', target.documentId);
                    }
                });
            }
            if (node.baselineActive && !node.baselineAltered) {
                for (const children of (renderParent.horizontalRows || [renderParent.renderChildren])) {
                    if (children.includes(node)) {
                        const unaligned = filterArray(children, item => item.positionRelative && item.length > 0 && convertFloat(node.verticalAlign) !== 0);
                        const length = unaligned.length;
                        if (length) {
                            unaligned.sort((a, b) => {
                                const topA = a.linear.top;
                                const topB = b.linear.top;
                                if (withinRange(topA, topB)) {
                                    return 0;
                                }
                                return topA < topB ? -1 : 1;
                            });
                            for (let i = 0; i < length; i++) {
                                const item = unaligned[i];
                                if (i === 0) {
                                    node.modifyBox(BOX_STANDARD.MARGIN_TOP, convertFloat(item.verticalAlign));
                                }
                                else {
                                    item.modifyBox(BOX_STANDARD.MARGIN_TOP, item.linear.top - unaligned[0].linear.top);
                                }
                                item.css('verticalAlign', '0px', true);
                            }
                        }
                        break;
                    }
                }
            }
        }
        else if (node.naturalElement && node.positionRelative) {
            const parent = node.actualParent as T;
            let preceding = false;
            let previous: T | undefined;
            for (const item of parent.naturalElements as T[]) {
                if (item === node) {
                    if (preceding) {
                        if (renderParent.layoutVertical && (node.top !== 0 || node.bottom !== 0)) {
                            const bounds = assignRect(node.boundingClientRect);
                            if (top !== 0) {
                                top -= bounds.top - node.bounds.top;
                            }
                            if (bottom !== 0) {
                                bottom += bounds.bottom - node.bounds.bottom;
                            }
                        }
                        if (renderParent.layoutHorizontal && (node.left !== 0 || node.right !== 0) && node.alignSibling('leftRight') === '') {
                            const bounds = assignRect(node.boundingClientRect);
                            if (left !== 0) {
                                left -= bounds.left - node.bounds.left;
                            }
                            if (right !== 0) {
                                right += bounds.right - node.bounds.right;
                            }
                        }
                    }
                    else if (renderParent.layoutVertical) {
                        if (top !== 0) {
                            if (previous?.blockStatic && previous.positionRelative && item.blockStatic) {
                                top -= previous.top;
                            }
                        }
                        else if (bottom !== 0) {
                            const getBox = item.getBox(BOX_STANDARD.MARGIN_TOP);
                            if (getBox[0] === 1) {
                                bottom -= item.marginTop;
                            }
                        }
                    }
                    break;
                }
                else if (item.positionRelative && item.renderParent === renderParent) {
                    preceding = true;
                }
                previous = item as T;
            }
        }
        if (top !== 0) {
            target.modifyBox(BOX_STANDARD.MARGIN_TOP, top);
        }
        else if (bottom !== 0) {
            target.modifyBox(BOX_STANDARD.MARGIN_TOP, bottom * -1);
        }
        if (verticalAlign !== 0) {
            target.modifyBox(BOX_STANDARD.MARGIN_TOP, verticalAlign * -1);
        }
        if (left !== 0) {
            if (target.autoMargin.left) {
                target.modifyBox(BOX_STANDARD.MARGIN_RIGHT, left * -1);
            }
            else {
                target.modifyBox(BOX_STANDARD.MARGIN_LEFT, left);
            }
        }
        else if (right !== 0) {
            target.modifyBox(BOX_STANDARD.MARGIN_LEFT, right * -1);
        }
    }
}