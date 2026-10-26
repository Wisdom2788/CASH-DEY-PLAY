// Isolated dev/test entry only. Vite production entry does not import this fixture.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import RankedPlay from '../src/features/ranked/RankedPlay';
import TasksView from '../src/features/tasks/TasksView';
import { useAuthStore } from '../src/store/auth.store';
import '../src/index.css';
const fixture=window as unknown as {__RANKED_TEST_TOKEN?:string;__RANKED_TEST_USER_ID?:number};
useAuthStore.setState({token:fixture.__RANKED_TEST_TOKEN??'local-browser-fixture',isAuthenticated:true,...(fixture.__RANKED_TEST_USER_ID?{user:{id:`tg_${fixture.__RANKED_TEST_USER_ID}`,telegramId:fixture.__RANKED_TEST_USER_ID,username:null,firstName:'Acceptance player',avatarUrl:null,isPhoneVerified:false,isPremium:false,xp:0,points:0,monthlyRank:null,monthlyTrend:null,matchesWonMonth:0,matchesPlayedMonth:0,referralCode:null,activeTaskDaysCount:0}}:{})});
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={new QueryClient()}><MemoryRouter><RankedPlay />{fixture.__RANKED_TEST_USER_ID&&<TasksView />}</MemoryRouter></QueryClientProvider></React.StrictMode>);
