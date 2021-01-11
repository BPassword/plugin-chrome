import MainLayout from '../layouts/MainLayout.vue';
import HomeIndex from '../views/Index.vue';

const routes = [
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '/index',
        component: HomeIndex,
        meta: {},
      },
    ],
    meta: {},
  },
];

export default routes;
