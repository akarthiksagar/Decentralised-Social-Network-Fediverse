// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ServerSelection from './pages/ServerSelection';
import {
  BookmarksPage,
  CommunitiesPage,
  ExplorePage,
  HomePage,
  NotificationsPage,
  ProfilePage,
  SettingsPage,
} from './pages/SocialApp';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/servers" element={<ServerSelection />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/communities" element={<CommunitiesPage />} />
        <Route path="/bookmarks" element={<BookmarksPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}
