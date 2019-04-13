import { NodeXmlTemplate } from '../../../src/base/@types/application';
import { CssGridCellData, CssGridData, CssGridDirectionData } from '../../../src/base/@types/extension';

import View from '../view';

import { BOX_ANDROID, CONTAINER_ANDROID } from '../lib/constant';
import { CONTAINER_NODE } from '../lib/enumeration';
import { createViewAttribute } from '../lib/util';

import $Layout = squared.base.Layout;

const $const = squared.base.lib.constant;
const $enum = squared.base.lib.enumeration;
const $dom = squared.lib.dom;
const $math = squared.lib.math;
const $util = squared.lib.util;

function getRowData(mainData: CssGridData<View>, direction: string) {
    const result: Undefined<View[]>[][] = [];
    if (direction === 'column') {
        for (let i = 0; i < mainData.column.count; i++) {
            result[i] = [];
            for (let j = 0; j < mainData.row.count; j++) {
                result[i].push(mainData.rowData[j][i]);
            }
        }
    }
    else {
        for (let i = 0; i < mainData.row.count; i++) {
            result.push(mainData.rowData[i]);
        }
    }
    return result;
}

function getGridSize(mainData: CssGridData<View>, direction: string, node: View) {
    const horizontal = direction === 'column';
    const dimension = horizontal ? 'width' : 'height';
    const data = mainData[direction];
    let value = 0;
    if (data.unit.length) {
        for (let i = 0; i < data.unit.length; i++) {
            const unit = data.unit[i];
            if (unit.endsWith('px')) {
                value += parseInt(unit);
            }
            else {
                let size = 0;
                $util.captureMap(
                    mainData.rowData[i] as View[][],
                    item => item && item.length > 0,
                    item => size = Math.min(size, item[0].bounds[dimension])
                );
                value += size;
            }
        }
    }
    else {
        value = $math.maxArray(data.unitTotal);
        if (value <= 0) {
            return 0;
        }
    }
    value += data.gap * (data.count - 1);
    if (node.contentBox) {
        if ($util.isUserAgent($util.USER_AGENT.FIREFOX)) {
            value += horizontal ? node.borderLeftWidth + node.borderRightWidth : node.borderTopWidth + node.borderBottomWidth;
        }
    }
    else {
        value += horizontal ? node.contentBoxWidth : node.contentBoxHeight;
    }
    return (horizontal ? node.actualWidth : node.actualHeight) - value;
}

function setContentSpacing(mainData: CssGridData<View>, node: View, alignment: string, direction: string) {
    const data = <CssGridDirectionData> mainData[direction];
    if (alignment.startsWith('space')) {
        const sizeTotal = getGridSize(mainData, direction, node);
        if (sizeTotal > 0) {
            let MARGIN_START: number;
            let MARGIN_END: number;
            let dimension: string;
            if (direction === 'column') {
                MARGIN_START = $enum.BOX_STANDARD.MARGIN_LEFT;
                MARGIN_END = $enum.BOX_STANDARD.MARGIN_RIGHT;
                dimension = 'width';
            }
            else {
                MARGIN_START = $enum.BOX_STANDARD.MARGIN_TOP;
                MARGIN_END = $enum.BOX_STANDARD.MARGIN_BOTTOM;
                dimension = 'height';
            }
            const rowData = getRowData(mainData, direction);
            const itemCount = mainData[direction].count;
            const adjusted = new Set<View>();
            function getMarginSize(value: number) {
                const marginSize = Math.floor(sizeTotal / value);
                return [marginSize, sizeTotal - (marginSize * value)];
            }
            switch (alignment) {
                case 'space-around': {
                    const [marginSize, marginExcess] = getMarginSize(itemCount * 2);
                    for (let i = 0; i < itemCount; i++) {
                        for (const item of new Set<View>($util.flatArray(rowData[i]))) {
                            if (item) {
                                const marginStart = (i > 0 && i <= marginExcess ? 1 : 0) + marginSize;
                                if (!adjusted.has(item)) {
                                    item.modifyBox(MARGIN_START, marginStart);
                                    item.modifyBox(MARGIN_END, marginSize);
                                    adjusted.add(item);
                                }
                                else {
                                    item.cssPX(dimension, sizeTotal / itemCount);
                                }
                            }
                        }
                    }
                    data.normal = false;
                    break;
                }
                case 'space-between': {
                    if (itemCount > 1) {
                        const [marginSize, marginExcess] = getMarginSize(itemCount - 1);
                        for (let i = 0; i < itemCount; i++) {
                            for (const item of new Set<View>($util.flatArray(rowData[i]))) {
                                if (item) {
                                    const marginEnd = (i < marginExcess ? 1 : 0) + marginSize;
                                    if (i < itemCount - 1) {
                                        if (!adjusted.has(item)) {
                                            item.modifyBox(MARGIN_END, marginEnd);
                                            adjusted.add(item);
                                        }
                                        else {
                                            item.cssPX(dimension, marginEnd);
                                        }
                                    }
                                    else {
                                        let span = 0;
                                        if (direction === 'column') {
                                            span = $util.convertInt(item.android('layout_columnSpan'));
                                        }
                                        else {
                                            span = $util.convertInt(item.android('layout_rowSpan'));
                                        }
                                        if (span > 1) {
                                            item.cssPX(dimension, marginEnd);
                                            if (adjusted.has(item)) {
                                                item.modifyBox(MARGIN_END, -marginEnd);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    data.normal = false;
                    break;
                }
                case 'space-evenly': {
                    const [marginSize, marginExcess] = getMarginSize(itemCount + 1);
                    for (let i = 0; i < itemCount; i++) {
                        for (const item of new Set<View>($util.flatArray(rowData[i]))) {
                            if (item) {
                                const marginEnd = (i < marginExcess ? 1 : 0) + marginSize;
                                if (!adjusted.has(item)) {
                                    if (i === 0) {
                                        item.modifyBox(MARGIN_START, marginSize);
                                    }
                                    item.modifyBox(MARGIN_END, marginEnd);
                                    adjusted.add(item);
                                }
                                else {
                                    item.cssPX(dimension, marginEnd);
                                }
                            }
                        }
                    }
                    data.normal = false;
                    break;
                }
            }
        }
    }
    else {
        const PADDING_START = direction === 'column' ? $enum.BOX_STANDARD.PADDING_LEFT : $enum.BOX_STANDARD.PADDING_TOP;
        const sizeTotal = getGridSize(mainData, direction, node);
        if (sizeTotal > 0) {
            switch (alignment) {
                case 'center':
                    node.modifyBox(PADDING_START, Math.floor(sizeTotal / 2));
                    data.normal = false;
                    break;
                case 'right':
                    if (direction === 'row') {
                        break;
                    }
                case 'end':
                case 'flex-end':
                    node.modifyBox(PADDING_START, sizeTotal);
                    data.normal = false;
                    break;
            }
        }
    }
}

export default class <T extends View> extends squared.base.extensions.CssGrid<T> {
    public processNode(node: T, parent: T) {
        super.processNode(node, parent);
        const mainData: CssGridData<T> = node.data($const.EXT_NAME.CSS_GRID, 'mainData');
        if (mainData) {
            const layout = new $Layout(
                parent,
                node,
                CONTAINER_NODE.GRID,
                $enum.NODE_ALIGNMENT.AUTO_LAYOUT,
                node.children as T[]
            );
            layout.rowCount = mainData.row.count;
            layout.columnCount = mainData.column.count;
            return {
                output: this.application.renderNode(layout),
                complete: true
            };
        }
        return undefined;
    }

    public processChild(node: T, parent: T) {
        const mainData: CssGridData<T> = parent.data($const.EXT_NAME.CSS_GRID, 'mainData');
        const cellData: CssGridCellData = node.data($const.EXT_NAME.CSS_GRID, 'cellData');
        let renderAs: T | undefined;
        let outputAs: NodeXmlTemplate<T> | undefined;
        if (mainData && cellData) {
            function applyLayout(item: T, direction: string, dimension: string) {
                const data: CssGridDirectionData = mainData[direction];
                const cellStart = `${direction}Start`;
                const cellSpan = `${direction}Span`;
                const cellTotal = cellData[cellSpan] - cellData[cellStart];
                const minDimension = `min${$util.capitalize(dimension)}`;
                let size = 0;
                let minSize = 0;
                let fitContent = false;
                let minUnitSize = 0;
                let sizeWeight = 0;
                if (data.unit.length && data.unit.every(value => value === 'auto')) {
                    if (dimension === 'width') {
                        data.unit = new Array(data.unit.length).fill('1fr');
                    }
                    else {
                        data.unit.length = 0;
                    }
                }
                for (let i = 0, j = 0; i < cellData[cellSpan]; i++) {
                    const unitMin = data.unitMin[cellData[cellStart] + i];
                    if (unitMin !== '') {
                        minUnitSize += parent.parseUnit(unitMin);
                    }
                    let unit = data.unit[cellData[cellStart] + i];
                    if (!unit) {
                        if (data.auto[j]) {
                            unit = data.auto[j];
                            if (data.auto[j + 1]) {
                                j++;
                            }
                        }
                        else {
                            continue;
                        }
                    }
                    if (unit === 'auto' || unit === 'min-content' || unit === 'max-content') {
                        if (cellTotal < data.unit.length && (!parent.has(dimension) || data.unit.some(value => $util.isLength(value)) || unit === 'min-content')) {
                            size = node.bounds[dimension];
                            minSize = 0;
                            sizeWeight = 0;
                        }
                        else {
                            size = 0;
                            minSize = 0;
                            sizeWeight = 0.01;
                        }
                        break;
                    }
                    else if ($util.isPercent(unit)) {
                        sizeWeight += parseFloat(unit) / 100;
                        minSize = size;
                        size = 0;
                    }
                    else if (unit.endsWith('fr')) {
                        if (dimension === 'width' || node.hasHeight) {
                            sizeWeight += parseFloat(unit);
                            minSize = size;
                        }
                        else {
                            sizeWeight = 0;
                            minSize = node.bounds[dimension];
                        }
                        size = 0;
                    }
                    else if (unit.endsWith('px')) {
                        const gap = parseFloat(unit);
                        if (minSize === 0) {
                            size += gap;
                        }
                        else {
                            minSize += gap;
                        }
                    }
                    if (unitMin === '0px' && node.textElement) {
                        fitContent = true;
                    }
                }
                if (cellData[cellSpan] > 1) {
                    const value = (cellData[cellSpan] - 1) * data.gap;
                    if (size > 0 && minSize === 0) {
                        size += value;
                    }
                    else if (minSize > 0) {
                        minSize += value;
                    }
                    if (minUnitSize > 0) {
                        minUnitSize += value;
                    }
                }
                if (minUnitSize > 0) {
                    if (data.autoFill && size === 0 && mainData[direction === 'column' ? 'row' : 'column'].count === 1) {
                        size = Math.max(node.actualWidth, minUnitSize);
                        sizeWeight = 0;
                    }
                    else {
                        minSize = minUnitSize;
                    }
                }
                item.android(`layout_${direction}`, cellData[cellStart].toString());
                if (cellData[cellSpan] > 1) {
                    item.android(`layout_${direction}Span`, cellData[cellSpan].toString());
                }
                if (minSize > 0 && !item.has(minDimension)) {
                    item.css(minDimension, $util.formatPX(minSize), true);
                }
                if (sizeWeight > 0) {
                    item.android(`layout_${direction}Weight`, $math.truncate(sizeWeight, node.localSettings.floatPrecision));
                    if (!item.has(dimension, $enum.CSS_STANDARD.LENGTH | $enum.CSS_STANDARD.PERCENT)) {
                        item.android(`layout_${dimension}`, '0px');
                        item.mergeGravity('layout_gravity', direction === 'column' ? 'fill_horizontal' : 'fill_vertical');
                    }
                }
                else if (size > 0) {
                    const maxDimension = `max${$util.capitalize(dimension)}`;
                    if (fitContent && !item.has(maxDimension)) {
                        item.css(maxDimension, $util.formatPX(size), true);
                        item.mergeGravity('layout_gravity', direction === 'column' ? 'fill_horizontal' : 'fill_vertical');
                    }
                    else if (!item.has(dimension)) {
                        item.css(dimension, $util.formatPX(size), true);
                    }
                }
            }
            const alignSelf = node.flexbox.alignSelf;
            const justifySelf = node.flexbox.justifySelf;
            if (/(start|end|center|baseline)/.test(alignSelf) || /(start|end|center|baseline|left|right)/.test(justifySelf)) {
                renderAs = this.application.createNode($dom.createElement(node.actualParent && node.actualParent.element));
                renderAs.tagName = node.tagName;
                renderAs.setControlType(CONTAINER_ANDROID.FRAME, CONTAINER_NODE.FRAME);
                renderAs.inherit(node, 'initial', 'base');
                renderAs.resetBox($enum.BOX_STANDARD.MARGIN | $enum.BOX_STANDARD.PADDING);
                renderAs.exclude({
                    procedure: $enum.NODE_PROCEDURE.CUSTOMIZATION,
                    resource: $enum.NODE_RESOURCE.BOX_STYLE | $enum.NODE_RESOURCE.ASSET
                });
                parent.appendTry(node, renderAs);
                renderAs.render(parent);
                node.inheritBox($enum.BOX_STANDARD.MARGIN, renderAs);
                applyLayout(renderAs, 'column', 'width');
                applyLayout(renderAs, 'row', 'height');
                let inlineWidth = false;
                if (justifySelf.endsWith('start') || justifySelf.endsWith('left') || justifySelf.endsWith('baseline')) {
                    node.mergeGravity('layout_gravity', 'left');
                    inlineWidth = true;
                }
                else if (justifySelf.endsWith('end') || justifySelf.endsWith('right')) {
                    node.mergeGravity('layout_gravity', 'right');
                    inlineWidth = true;
                }
                else if (justifySelf.endsWith('center')) {
                    node.mergeGravity('layout_gravity', 'center_horizontal');
                    inlineWidth = true;
                }
                if (!node.hasWidth) {
                    node.android('layout_width', inlineWidth ? 'wrap_content' : 'match_parent', false);
                }
                if (alignSelf.endsWith('start') || alignSelf.endsWith('baseline')) {
                    node.mergeGravity('layout_gravity', 'top');
                }
                else if (alignSelf.endsWith('end')) {
                    node.mergeGravity('layout_gravity', 'bottom');
                }
                else if (alignSelf.endsWith('center')) {
                    node.mergeGravity('layout_gravity', 'center_vertical');
                }
                else if (!node.hasHeight) {
                    node.android('layout_height', 'match_parent', false);
                }
                node.parent = renderAs;
                outputAs = this.application.renderNode(
                    new $Layout(
                        parent,
                        renderAs,
                        CONTAINER_NODE.FRAME,
                        $enum.NODE_ALIGNMENT.SINGLE,
                        renderAs.children as T[]
                    )
                );
            }
            const target = renderAs || node;
            applyLayout(target, 'column', 'width');
            applyLayout(target, 'row', 'height');
            if (!target.has('height')) {
                if (parent.hasHeight && mainData.alignContent === 'normal') {
                    target.android('layout_height', '0px');
                    target.android('layout_rowWeight', '1');
                }
                if (!(mainData.row.count === 1 && mainData.alignContent === 'space-between')) {
                    target.mergeGravity('layout_gravity', 'fill_vertical');
                }
            }
            if (!target.has('width')) {
                target.mergeGravity('layout_gravity', 'fill_horizontal');
            }
        }
        return {
            parent: renderAs,
            renderAs,
            outputAs
        };
    }

    public postBaseLayout(node: T) {
        const mainData: CssGridData<T> = node.data($const.EXT_NAME.CSS_GRID, 'mainData');
        if (mainData) {
            if (node.hasWidth && mainData.justifyContent !== 'normal') {
                setContentSpacing(mainData, node, mainData.justifyContent, 'column');
            }
            if (node.hasHeight && mainData.alignContent !== 'normal') {
                setContentSpacing(mainData, node, mainData.alignContent, 'row');
            }
            if (mainData.column.normal && !mainData.column.unit.includes('auto')) {
                const columnGap =  mainData.column.gap * (mainData.column.count - 1);
                if (columnGap > 0) {
                    if (node.renderParent && !node.renderParent.hasAlign($enum.NODE_ALIGNMENT.AUTO_LAYOUT)) {
                        node.cssPX('minWidth', columnGap);
                        node.cssPX('width', columnGap, false, true);
                    }
                    if (!node.has('width') && node.has('maxWidth')) {
                        node.css('width', $util.formatPX(node.actualWidth + columnGap), true);
                    }
                }
            }
        }
    }

    public postProcedure(node: T) {
        const mainData: CssGridData<T> = node.data($const.EXT_NAME.CSS_GRID, 'mainData');
        if (mainData) {
            const controller = <android.base.Controller<T>> this.application.controllerHandler;
            const lastChild = Array.from(mainData.children)[mainData.children.size - 1];
            if (mainData.column.unit.length && mainData.column.unit.every(value => $util.isPercent(value))) {
                const percentTotal = mainData.column.unit.reduce((a, b) => a + parseFloat(b), 0);
                if (percentTotal < 100) {
                    node.android('columnCount', (mainData.column.count + 1).toString());
                    for (let i = 0; i < mainData.row.count; i++) {
                        controller.addAfterOutsideTemplate(
                            lastChild.id,
                            controller.renderSpace(
                                $util.formatPercent(100 - percentTotal),
                                'wrap_content',
                                0,
                                0,
                                createViewAttribute({
                                    android: {
                                        [node.localizeString(BOX_ANDROID.MARGIN_LEFT)]: $util.formatPX(mainData.column.gap),
                                        layout_row: i.toString(),
                                        layout_column: mainData.column.count.toString()
                                    }
                                })
                            )
                        );
                    }
                }
            }
            for (let i = 0; i < mainData.emptyRows.length; i++) {
                const item = mainData.emptyRows[i];
                if (item) {
                    for (let j = 0; j < item.length; j++) {
                        if (item[j] === 1) {
                            controller.addAfterOutsideTemplate(
                                lastChild.id,
                                controller.renderSpace(
                                    'wrap_content',
                                    $util.formatPX(mainData.row.gap),
                                    0,
                                    0,
                                    createViewAttribute({
                                        android: {
                                            layout_row: i.toString(),
                                            layout_column: j.toString()
                                        }
                                    })
                                )
                            );
                            break;
                        }
                    }
                }
            }
        }
    }
}