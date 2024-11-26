import React from 'react';
import { BillingList } from 'src/billing/List/BillingList';
import FooterWrapper from 'src/components/FooterWrapper';
import { TopBar } from 'src/components/TopBar';
import * as Nav from 'src/libs/nav';
import * as Style from 'src/libs/style';

interface BillingListPageProps {
  queryParams: {
    selectedName: string | undefined;
  };
}

export const BillingListPage = (props: BillingListPageProps) => {
  const selectedName = props.queryParams.selectedName;
  const breadcrumbs = 'Billing > Billing Project';

  return (
    <FooterWrapper fixedHeight>
      <TopBar title='Billing' href={selectedName ? Nav.getLink('billing') : undefined}>
        {!!selectedName && (
          <div style={Style.breadcrumb.breadcrumb}>
            <div style={Style.noWrapEllipsis}>{breadcrumbs}</div>
            <div style={Style.breadcrumb.textUnderBreadcrumb}>{selectedName}</div>
          </div>
        )}
      </TopBar>
      <BillingList queryParams={{ selectedName }} />
    </FooterWrapper>
  );
};

export const navPaths = [
  {
    name: 'billing',
    path: '/billing',
    component: BillingListPage,
    title: 'Billing',
  },
];
