import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'connexion',
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
      {
        path: 'tableau-de-bord',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'cibles',
        loadComponent: () => import('./features/targets/targets.component').then(m => m.TargetsComponent),
      },
      {
        path: 'campagnes',
        loadComponent: () => import('./features/campaigns/campaigns.component').then(m => m.CampaignsComponent),
      },
      {
        path: 'scenarios-de-test',
        loadComponent: () => import('./features/testcase/testcase.component').then(m => m.TestcaseComponent),
      },
      {
        path: 'testcase',
        redirectTo: 'scenarios-de-test',
        pathMatch: 'full',
      },
      {
        path: 'historique',
        loadComponent: () => import('./features/history/history.component').then(m => m.HistoryComponent),
      },
      {
        path: 'profil',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
