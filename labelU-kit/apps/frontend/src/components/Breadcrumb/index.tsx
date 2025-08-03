import type { Params } from 'react-router-dom';
import { useMatches, useNavigate, useRevalidator, useLocation } from 'react-router-dom';
import { useTranslation } from '@labelu/i18n';

import StyledBreadcrumb, { BreadcrumbItem } from './style';

export interface Match {
  id: string;
  pathname: string;
  params: Params<string>;
  data: unknown;
  handle: {
    crumb?: (data?: any) => React.ReactNode;
  };
}

export interface BreadcrumbProps {
  className?: string;
  // 有些页面不需要显示首页的标题
  hideHome?: boolean;
  style?: React.CSSProperties;
}

/**
 * 面包屑导航
 * 通过react-router-dom 的useMatches得到route的父子路径
 */
function Breadcrumb({ className, hideHome = false, style }: BreadcrumbProps) {
  const matches = useMatches() as Match[];
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const location = useLocation();
  const { t } = useTranslation();

  const crumbs = matches
    .filter((match) => {
      if (match.pathname === '/' && hideHome) {
        return false;
      }

      return match.handle && match.handle.crumb && match.handle.crumb(match.data);
    })
    .map((match) => ({
      ...match,
      crumb: match.handle.crumb!(match.data),
      pathname: match.pathname,
    }));

  const handleLinkClick = (pathname: string) => () => {
    navigate(pathname);
    // 通过面包屑跳转后，重新调用路由的loader来获得数据
    setTimeout(revalidator.revalidate);
  };

  // 判断是否在顶级页面（只有一层路径或没有深层面包屑）
  const isTopLevel = crumbs.length <= 1;

  // 顶级导航项
  const topLevelNavItems = [
    {
      pathname: '/tasks',
      crumb: t('taskList'), // "任务大厅"
      isActive: location.pathname === '/tasks' || location.pathname === '/',
    },
    {
      pathname: '/capability-showcase',
      crumb: t('capabilityShowcase'), // "能力展示"
      isActive: location.pathname === '/capability-showcase',
    },
  ];

  return (
    // @ts-ignore
    <StyledBreadcrumb className={className} style={style}>
      {isTopLevel ? (
        // 顶级页面：显示主要导航项
        <>
          {topLevelNavItems.map((item, index) => (
            <div key={`top-${index}`} className="breadcrumb-item-wrap">
              <BreadcrumbItem 
                to={item.pathname} 
                isCurrent={item.isActive}
                onClick={handleLinkClick(item.pathname)}
                style={{
                  fontWeight: item.isActive ? 'bold' : 'normal',
                  color: item.isActive ? '#333' : '#999',
                }}
              >
                {item.crumb}
              </BreadcrumbItem>
              {index < topLevelNavItems.length - 1 && (
                <span className="breadcrumb-item-separator">  </span>
              )}
            </div>
          ))}
        </>
      ) : (
        // 深层页面：显示正常的面包屑
        <>
          {crumbs.map((item, index) => {
            const isCurrent = index === crumbs.length - 1;

            if (!isCurrent) {
              return (
                <div key={index} className="breadcrumb-item-wrap">
                  <BreadcrumbItem to={item.pathname} isCurrent={false} onClick={handleLinkClick(item.pathname)}>
                    {item.crumb}
                  </BreadcrumbItem>
                  <span className="breadcrumb-item-separator">/</span>
                </div>
              );
            }

            return (
              <BreadcrumbItem as="span" isCurrent key={index}>
                {item.crumb}
              </BreadcrumbItem>
            );
          })}
        </>
      )}
    </StyledBreadcrumb>
  );
}

export default Breadcrumb;
