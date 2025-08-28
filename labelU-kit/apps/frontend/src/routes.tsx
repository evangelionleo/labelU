import type { RouteObject } from 'react-router';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useEffect } from 'react';
import { i18n } from '@labelu/i18n';

import Register from '@/pages/register';
import Tasks from '@/pages/tasks';
import TaskEdit from '@/pages/tasks.[id].edit';
import TaskAnnotation from '@/pages/tasks.[id].samples.[id]';
import Samples from '@/pages/tasks.[id]';
import TaskSamplesFinished from '@/pages/tasks.[id].samples.finished';
import Page404 from '@/pages/404';
import MainLayout from '@/layouts/MainLayoutWithNavigation';
import Dashboard from '@/pages/dashboard';
import PreAnnotation from '@/pages/pre-annotation';
import Users from '@/pages/users';
import Teams from '@/pages/teams';
import Reports from '@/pages/reports';

import type { TaskLoaderResult } from './loaders/task.loader';
import { taskLoader, tasksLoader } from './loaders/task.loader';
import { rootLoader } from './loaders/root.loader';
import { sampleLoader } from './loaders/sample.loader';
import RequireAuth from './components/RequireSSO';
import { registerLoader } from './loaders/register.loader';
import { loginLoader } from './loaders/login.loader';
import LoginPage from './pages/login';
import CapabilityShowcase from './pages/CapabilityShowcase';
import ImageAnnotation from './pages/CapabilityShowcase/ImageAnnotation';

function Root() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // 如果是根路径，跳转到仪表板（以仪表板为首页）
    if (location.pathname === '/' || location.pathname === '') {
      navigate('/dashboard');
    }
  }, [location.pathname, navigate]);

  if (!window.IS_ONLINE) {
    return <Outlet />;
  }

  return (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  );
}

const routes: RouteObject[] = [
  {
    path: '/',
    id: 'root',
    element: <Root />,
    loader: rootLoader,
    children: [
      {
        path: 'dashboard',
        element: <MainLayout />,
        errorElement: <Page404 />,
        id: 'dashboard',
        handle: {
          crumb: () => {
            return i18n.t('dashboard');
          },
        },
        children: [
          {
            index: true,
            element: <Dashboard />,
          },
        ],
      },
      {
        path: 'pre-annotation',
        element: <MainLayout />,
        errorElement: <Page404 />,
        id: 'pre-annotation',
        handle: {
          crumb: () => {
            return '预标注任务';
          },
        },
        children: [
          {
            index: true,
            element: <PreAnnotation />,
          },
        ],
      },
      {
        path: 'users',
        element: <MainLayout />,
        errorElement: <Page404 />,
        id: 'users',
        handle: {
          crumb: () => {
            return '用户管理';
          },
        },
        children: [
          {
            index: true,
            element: <Users />,
          },
        ],
      },
      {
        path: 'teams',
        element: <MainLayout />,
        errorElement: <Page404 />,
        id: 'teams',
        handle: {
          crumb: () => {
            return '团队管理';
          },
        },
        children: [
          {
            index: true,
            element: <Teams />,
          },
        ],
      },
      {
        path: 'reports',
        element: <MainLayout />,
        errorElement: <Page404 />,
        id: 'reports',
        handle: {
          crumb: () => {
            return '报表中心';
          },
        },
        children: [
          {
            index: true,
            element: <Reports />,
          },
        ],
      },
      {
        path: 'tasks',
        element: <MainLayout />,
        errorElement: <Page404 />,
        id: 'tasks',
        loader: tasksLoader,
        handle: {
          crumb: () => {
            return '任务大厅';
          },
        },
        children: [
          {
            index: true,
            element: <Tasks />,
          },
          {
            path: ':taskId',
            id: 'task',
            element: <Outlet />,
            loader: taskLoader,
            handle: {
              crumb: (data: TaskLoaderResult) => {
                return data?.task?.name;
              },
            },
            children: [
              {
                index: true,
                element: <Samples />,
              },
              {
                path: 'edit',
                element: <TaskEdit />,
                loader: async ({ params }) => {
                  return params.taskId !== '0' ? i18n.t('taskEdit') : i18n.t('createTask');
                },
                handle: {
                  crumb: (data: string) => {
                    return data;
                  },
                },
              },
              {
                path: 'samples',
                id: 'samples',
                element: <Outlet />,
                children: [
                  {
                    path: ':sampleId',
                    element: <TaskAnnotation />,
                    loader: sampleLoader,
                    id: 'annotation',
                    handle: {
                      crumb: () => {
                        return i18n.t('start');
                      },
                    },
                  },
                  {
                    path: 'finished',
                    element: <TaskSamplesFinished />,
                    loader: taskLoader,
                    handle: {
                      crumb: () => {
                        return i18n.t('finished');
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        path: 'capability-showcase',  // 去掉开头的斜杠
        element: <MainLayout />,      // 使用主布局
        handle: {
          crumb: () => {
            return i18n.t('capabilityShowcase');
          },
        },
        children: [
          {
            index: true,
            element: <CapabilityShowcase />,
          },
          {
            path: 'image-annotation',
            element: <ImageAnnotation />,
            handle: {
              crumb: () => {
                return '图像标注演示';
              },
            },
          },
        ],
      },
    ],
  },
  {
    path: 'login',
    loader: loginLoader,
    element: <LoginPage />,
  },
  {
    path: 'register',
    loader: registerLoader,
    element: <Register />,
    handle: {
      crumb: () => {
        return i18n.t('signUp');
      },
    },
  },
  {
    path: '*',
    element: <Page404 />,
  },
];

export default routes;
