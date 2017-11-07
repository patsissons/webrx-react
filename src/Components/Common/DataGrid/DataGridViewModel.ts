import { Iterable } from 'ix';
import { Observable } from 'rxjs';

import { IterableLike, ObservableOrValue, ObservableLike, ReadOnlyProperty, Command } from '../../../WebRx';
import { ObjectComparer, SortDirection } from '../../../Utils/Compare';
import { ListItemsViewModel } from '../ListItems/ListItemsViewModel';
import { PagerViewModel, PageRequest } from '../Pager/PagerViewModel';

export interface SortArgs {
  field: string;
  direction: SortDirection;
}

export interface DataSourceRequest<TContext = any> {
  page?: PageRequest;
  sort?: SortArgs;
  context?: TContext;
}

export interface DataSourceResponse<T> {
  items: IterableLike<T>;
  count: number;
}

export class DataGridViewModel<T, TRequestContext = any> extends ListItemsViewModel<T> {
  public static displayName = 'DataGridViewModel';

  protected readonly comparer: ObjectComparer<T>;

  public readonly pager: PagerViewModel | null;

  public readonly isLoading: ReadOnlyProperty<boolean>;
  public readonly requests: ReadOnlyProperty<DataSourceRequest<TRequestContext> | undefined>;
  public readonly responses: ReadOnlyProperty<DataSourceResponse<T> | undefined>;
  public readonly projectedSource: ReadOnlyProperty<IterableLike<T>>;
  public readonly projectedCount: ReadOnlyProperty<number>;

  public readonly sort: Command<SortArgs>;
  public readonly toggleSortDirection: Command<string>;

  /**
   * @param source data source.
   * @param pager pager. if omitted a default pager will be created. use null for no pager.
   * @param context request context included in projection requests. if included requests are bound to context events.
   * @param comparer custom object comparer. if omitted a default object comparer will be used.
   */
  constructor(
    source: ObservableLike<IterableLike<T>>,
    pager?: PagerViewModel | null,
    context?: ObservableLike<TRequestContext>,
    comparer: string | ObjectComparer<T> = new ObjectComparer<T>(),
  ) {
    super(source);

    this.pager = pager === null ? null : (pager || new PagerViewModel());
    this.comparer = String.isString(comparer) ? new ObjectComparer<T>(comparer) : comparer;

    this.sort = this.wx.command<SortArgs>();
    this.toggleSortDirection = this.wx.command<string>();

    this.requests = this.getRequests(context)
      .toProperty(undefined, false);

    this.responses = this.getResponses()
      .toProperty(undefined, false);

    this.isLoading = Observable
      .merge(
        this.requests.changed
          .map(() => true),
        this.responses.changed
          .map(() => false),
      )
      .toProperty(true);

    const validResponses = this.wx
      .whenAny(this.responses, x => x)
      .filterNull()
      .share();

    this.projectedSource = validResponses
      .map(x => x.items)
      .toProperty(Iterable.empty<T>(), false);

    this.projectedCount = validResponses
      .map(x => x.count)
      .toProperty();

    if (this.pager != null) {
      this.addSubscription(
        this.wx
          .whenAny(
            this.projectedCount,
            x => x,
          )
          .filterNull()
          .invokeCommand(this.pager.updateCount),
      );

      this.addSubscription(
        this.wx
          .whenAny(this.sort, () => 1)
          .invokeCommand(this.pager.selectPage),
      );
    }

    this.addSubscription(
      this.wx
        .whenAny(
          this.toggleSortDirection,
          x => x,
        )
        .withLatestFrom(
          this.wx.whenAny(this.requests, x => x),
          (field, request) => ({ field, request }),
        )
        .map(x => {
          const sortArgs: SortArgs = {
            field: x.field,
            direction: this.getReverseSortDirection(x.field, x.request),
          };

          return sortArgs;
        })
        .invokeCommand(this.sort),
    );

    this.addSubscription(
      this.wx
        .whenAny(
          this.sort,
          x => this.selectedItems.value,
        )
        .invokeCommand(this.selectItems),
    );
  }

  getItemsSourceProperty() {
    return this.projectedSource || super.getItemsSourceProperty();
  }

  protected getReverseSortDirection(field: string, request: DataSourceRequest | undefined) {
    // we have no sort direction state
    if (request == null || request.sort == null || request.sort.direction == null) {
      return SortDirection.Ascending;
    }

    // we have no sort field state or we are sorting a new field
    if (request.sort.field == null || request.sort.field !== field) {
      return SortDirection.Ascending;
    }

    // reverse the current sort direction
    return request.sort.direction === SortDirection.Ascending ?
      SortDirection.Descending :
      SortDirection.Ascending;
  }

  protected getRequest(
    source: IterableLike<T>,
    page: PageRequest | undefined,
    sort: SortArgs | undefined,
    context: TRequestContext | undefined,
  ): DataSourceRequest<TRequestContext> | undefined {
    return {
      page,
      sort,
      context,
    };
  }

  protected getRequests(context?: ObservableLike<TRequestContext>, rateLimit = 100) {
    const pagerObservable = this.pager == null ?
      Observable.of(undefined) :
      this.pager.requests;

    const source = this.wx
      .whenAny(this.source, x => x)
      .filter(x => x !== this.emptySource);

    return this.wx
      .whenAny(
        source,
        pagerObservable,
        this.sort.results.startWith(undefined),
        context || Observable.of(undefined),
        (src, page, sort, ctx) => {
          return this.getRequest(src, page, sort, ctx);
        },
      )
      .debounceTime(rateLimit);
  }

  protected getResponse(request: DataSourceRequest<TRequestContext> | undefined): ObservableOrValue<DataSourceResponse<T> | undefined> {
    if (request == null) {
      return undefined;
    }

    const items = Iterable
      .from(this.source.value);

    return this.getResponseFromItems(items, request);
  }

  protected getResponseFromItems(items: Iterable<T>, request: DataSourceRequest<TRequestContext>): ObservableOrValue<DataSourceResponse<T> | undefined> {
    const count = items.count();

    if (this.comparer != null && request.sort != null && !String.isNullOrEmpty(request.sort.field) && request.sort.direction != null) {
      items = this.comparer.sortIterable(items, request.sort.field, request.sort.direction);
    }

    if (request.page != null) {
      if ((request.page.offset || 0) > 0) {
        items = items
          .skip(request.page.offset);
      }

      if ((request.page.limit || 0) > 0) {
        items = items
          .take(request.page.limit);
      }
    }

    return {
      items,
      count,
    };
  }

  protected getResponses(requests?: ObservableLike<DataSourceRequest<TRequestContext> | undefined>, rateLimit = 100) {
    return this.wx
      .whenAny(requests || this.requests, x => x)
      // because requests can be injected here, we cannot trust that nulls are not already filtered out
      // so we filter here just to be safe (this should be a no-op in most cases)
      .filterNull()
      .flatMap(x => {
        return this.wx.getObservable(this.getResponse(x));
      })
      .filterNull()
      .debounceTime(rateLimit);
  }
}
