import { RawAsset } from '../../../src/base/@types/application';

import { CONTAINER_ANDROID } from '../lib/constant';
import { CONTAINER_NODE } from '../lib/enumeration';

import $Layout = squared.base.Layout;

const $const = squared.lib.constant;
const $css = squared.lib.css;
const $c = squared.base.lib.constant;
const $e = squared.base.lib.enumeration;

type SpriteData = {
    image: Required<RawAsset>,
    position: BoxRectPosition
};

export default class <T extends android.base.View> extends squared.base.extensions.Sprite<T> {
    public processNode(node: T, parent: T) {
        const mainData = <SpriteData> node.data($c.EXT_NAME.SPRITE, $c.STRING_BASE.EXT_DATA);
        if (mainData) {
            const drawable = (<android.base.Resource<T>> this.application.resourceHandler).addImageSrc(node.backgroundImage);
            if (drawable !== '') {
                const container = this.application.createNode(<HTMLElement> node.element);
                container.inherit(node, 'initial', 'base', 'styleMap');
                container.setControlType(CONTAINER_ANDROID.FRAME, CONTAINER_NODE.FRAME);
                container.exclude({
                    procedure: $e.NODE_PROCEDURE.CUSTOMIZATION,
                    resource: $e.NODE_RESOURCE.IMAGE_SOURCE
                });
                parent.appendTry(node, container);
                node.setControlType(CONTAINER_ANDROID.IMAGE, CONTAINER_NODE.IMAGE);
                node.exclude({ resource: $e.NODE_RESOURCE.FONT_STYLE | $e.NODE_RESOURCE.BOX_STYLE });
                node.cssApply({
                    position: 'static',
                    top: $const.CSS.AUTO,
                    right: $const.CSS.AUTO,
                    bottom: $const.CSS.AUTO,
                    left: $const.CSS.AUTO,
                    display: 'inline-block',
                    width: $css.formatPX(mainData.image.width),
                    height: $css.formatPX(mainData.image.height),
                    marginTop: $css.formatPX(mainData.position.top),
                    marginRight: $const.CSS.PX_0,
                    marginBottom: $const.CSS.PX_0,
                    marginLeft: $css.formatPX(mainData.position.left),
                    paddingTop: $const.CSS.PX_0,
                    paddingRight: $const.CSS.PX_0,
                    paddingBottom: $const.CSS.PX_0,
                    paddingLeft: $const.CSS.PX_0,
                    borderTopStyle: $const.CSS.NONE,
                    borderRightStyle: $const.CSS.NONE,
                    borderBottomStyle: $const.CSS.NONE,
                    borderLeftStyle: $const.CSS.NONE,
                    borderRadius: $const.CSS.PX_0,
                    backgroundPositionX: $const.CSS.PX_0,
                    backgroundPositionY: $const.CSS.PX_0,
                    backgroundColor: 'rgba(0, 0, 0, 0)'
                });
                node.unsetCache();
                node.android('src', `@drawable/${drawable}`);
                node.outerWrapper = container;
                container.innerWrapped = node;
                node.parent = container;
                return {
                    renderAs: container,
                    outputAs: this.application.renderNode(
                        new $Layout(
                            parent,
                            container,
                            CONTAINER_NODE.FRAME,
                            $e.NODE_ALIGNMENT.SINGLE,
                            container.children as T[]
                        )
                    ),
                    parent: container,
                    complete: true
                };
            }
        }
        return undefined;
    }
}