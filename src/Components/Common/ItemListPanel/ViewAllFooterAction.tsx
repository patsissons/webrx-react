import * as React from 'react';
import { Icon } from 'react-fa';

import './ViewAllFooterAction.less';

export interface ViewAllFooterActionProps extends React.HTMLAttributes {
  suffix?: string;
}

export class ViewAllFooterAction extends React.Component<ViewAllFooterActionProps, any> {
  public static displayName = 'ViewAllFooterAction';

  static defaultProps = {
    suffix: '',
  };

  render() {
    return (
      <div className='ViewAllFooterAction'>
        <span>{ `View All${ String.isNullOrEmpty(this.props.suffix) === true ? '' : ` ${ this.props.suffix }` }` }</span>
        <Icon name='caret-right' />
      </div>
    );
  }
}
