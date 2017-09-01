import * as React from 'react';
import { Iterable } from 'ix';

import { IterableLike } from '../../../WebRx';
import { wxr } from '../../React';
import { Panel, StackPanel } from '../Panel';

export interface ItemsPresenterTemplateProps {
  /**
   * template that wraps the entire control.
   * use this to compose the exterior of the the view.
   * render the items presenter where you want the items panel located.
   */
  viewTemplate?: (itemsPanel: React.ReactNode, itemsPresenter: ItemsPresenter) => JSX.Element | null | false;

  /**
   * template to render panel responsible for items layout.
   * this template can control how items are rendered next to one another
   * (i.e., wrapping, stack, grid, etc...)
   */
  itemsPanelTemplate?: (itemTemplates: Array<React.ReactNode>) => React.ReactNode;

  /**
   * template to render each item
   */
  itemTemplate?: (item: {}, index: number) => React.ReactNode;
}

export interface ItemsPresenterProps extends React.HTMLAttributes<ItemsPresenterProps>, ItemsPresenterTemplateProps {
  itemsSource: IterableLike<{}>;
}

export class ItemsPresenter extends React.Component<ItemsPresenterProps> {
  public static displayName = 'ItemsPresenter';

  public static defaultItemTemplate(item: {}, index: number) {
    return (
      <div key={ index }>{ item.toString() }</div>
    );
  }

  public static defaultPanelTemplate(itemTemplates: Array<React.ReactNode>) {
    return (
      <StackPanel>{ itemTemplates }</StackPanel>
    );
  }

  public static defaultViewTemplate(itemsPanel: React.ReactNode, itemPresenter: ItemsPresenter) {
    const { className, props, rest } = itemPresenter.restProps(x => {
      const { itemsSource, viewTemplate, itemsPanelTemplate, itemTemplate } = x;
      return { itemsSource, viewTemplate, itemsPanelTemplate, itemTemplate };
    });

    return (
      <div { ...rest } className={ wxr.classNames('ItemsPresenter', className) }>
        { itemsPanel }
      </div>
    );
  }

  render() {
    return this.renderViewTemplate();
  }

  protected renderItemTemplates() {
    const template = this.props.itemTemplate || ItemsPresenter.defaultItemTemplate;

    const items = Iterable
      .from(this.props.itemsSource)
      .toArray();

    const itemTemplates = items
      .map<React.ReactNode>((x, i) => {
        const item = template.apply(this, [ x, i, items ]);

        return React.cloneElement(item, { key: item.key || i });
      });

    return { items, itemTemplates };
  }

  protected renderPanelTemplate(): React.ReactNode {
    const template = this.props.itemsPanelTemplate || ItemsPresenter.defaultPanelTemplate;
    const { items, itemTemplates } = this.renderItemTemplates();

    return template.apply(this, [ itemTemplates, items ]);
  }

  protected renderViewTemplate(): JSX.Element | null | false {
    const template = this.props.viewTemplate || ItemsPresenter.defaultViewTemplate;
    const itemsPanel = this.renderPanelTemplate();

    return template.apply(this, [ itemsPanel, this ]);
  }
}
