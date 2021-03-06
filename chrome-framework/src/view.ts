import { CachedValue } from '../../@types/base/node';

type T = View;

export default class View extends squared.base.Node implements chrome.base.View {
    public queryMap?: T[][];

    protected _cached: CachedValue<T> = {};
    protected _documentParent?: T;

    constructor(
        id: number,
        sessionId: string,
        element: Element,
        afterInit?: BindGeneric<T, void>)
    {
        super(id, sessionId, element);
        this.init();
        if (afterInit) {
            afterInit(this);
        }
    }
}