import * as Rx from 'rx';
import * as wx from 'webrx';

import { BaseRoutableViewModel } from '../../React/BaseRoutableViewModel';
import { DataGridViewModel } from '../DataGrid/DataGridViewModel';

export abstract class BaseItemListPanelViewModel<TData> extends BaseRoutableViewModel<any> {
  public static displayName = 'BaseItemListPanelViewModel';

  public navigate: wx.ICommand<TData>;

  constructor(
    public grid: DataGridViewModel<TData>,
    public isLoading: boolean | wx.IObservableProperty<boolean> = false,
    isRoutingEnabled?: boolean
  ) {
    super(isRoutingEnabled);

    this.navigate = wx.asyncCommand((x: TData) => Rx.Observable.return(x));
  }

  public get items() {
    return this.grid.items;
  }

  public get lengthChanged() {
    return wx
      .whenAny(this.items, x => (x || []).length)
      .distinctUntilChanged();
  }

  getSearch() {
    return this.grid.getSearch();
  }
}
