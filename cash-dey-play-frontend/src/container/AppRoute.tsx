import React, { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import routes from '../config/routes.config';
import AppLayout from './AppLayout';

const HomeDashboard = React.lazy(() => import('../features/home/HomeDashboard'));
const MatchmakingLobby = React.lazy(() => import('../features/lobby/MatchmakingLobby'));
const WhotGameBoard = React.lazy(() => import('../features/game/WhotGameBoard'));
const MatchResultView = React.lazy(() => import('../features/result/MatchResultView'));
const TasksView = React.lazy(() => import('../features/tasks/TasksView'));
const LeaderboardView = React.lazy(() => import('../features/leaderboard/LeaderboardView'));
const ProfileView = React.lazy(() => import('../features/profile/ProfileView'));
const WalletView = React.lazy(() => import('../features/wallet/WalletView'));

export default function AppRoute() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path={routes.home} element={<HomeDashboard />} />
        <Route path={routes.lobby} element={<MatchmakingLobby />} />
        <Route path={routes.game} element={<WhotGameBoard />} />
        <Route path={routes.result} element={<MatchResultView />} />
        <Route path={routes.tasks} element={<TasksView />} />
        <Route path={routes.leaderboard} element={<LeaderboardView />} />
        <Route path={routes.profile} element={<ProfileView />} />
        <Route path={routes.wallet} element={<WalletView />} />
      </Route>
    </Routes>
  );
}
