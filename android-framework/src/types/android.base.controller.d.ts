import { UserSettingsAndroid, ViewAttribute } from './application';

declare global {
    namespace android.base {
        export interface Controller<T extends View> extends squared.base.Controller<T> {
            readonly userSettings: UserSettingsAndroid;
            checkFrameHorizontal(data: squared.base.Layout<T>): boolean;
            checkConstraintFloat(data: squared.base.Layout<T>): boolean;
            checkConstraintHorizontal(data: squared.base.Layout<T>): boolean;
            checkRelativeHorizontal(data: squared.base.Layout<T>): boolean;
            createNodeWrapper(node: T, parent?: T, controlName?: string, containerType?: number): T;
            renderSpace(depth: number, width: string, height?: string, columnSpan?: number, rowSpan?: number, options?: ViewAttribute): string;
            addGuideline(node: T, parent: T, orientation?: string, percent?: boolean, opposite?: boolean): void;
        }

        export class Controller<T extends View> implements Controller<T> {
            public static evaluateAnchors<T extends View>(nodes: T[]): void;
            public static setConstraintDimension<T extends View>(node: T): void;
            public static setFlexDimension<T extends View>(node: T, horizontal: boolean): void;
        }
    }
}

export {};