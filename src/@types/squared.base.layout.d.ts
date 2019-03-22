import { LayoutType } from '../base/@types/application';

import Container = squared.lib.base.Container;

declare global {
    namespace squared.base {
        interface Layout<T extends Node> extends Container<T>, LayoutType {
            parent: T;
            node: T;
            itemCount: number;
            rowCount: number;
            columnCount: number;
            renderIndex: number;
            orderAltered: boolean;
            readonly linearX: boolean;
            readonly linearY: boolean;
            readonly floated: Set<string>;
            readonly cleared: Map<T, string>;
            readonly visible: T[];
            init(): void;
            setType(containerType: number, ...alignmentType: number[]): void;
            add(value: number): number;
            delete(value: number): number;
        }

        class Layout<T extends Node> implements Layout<T> {
            constructor(parent: T, node: T, containerType?: number, alignmentType?: number, itemCount?: number, children?: T[]);
        }
    }
}

export = squared.base.Layout;