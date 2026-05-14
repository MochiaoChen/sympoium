/**
 * App — HashRouter setup
 *
 * Single route: / → Home (main 7-act interface)
 * Also handles Zhihu OAuth callback on mount.
 */

import { useEffect, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home';
import { exchangeCodeForToken, fetchZhihuUser } from '@/services/api';
import { useSymposiumStore } from '@/store/useSymposiumStore';

function OAuthHandler() {
  const hasHandled = useRef(false);

  useEffect(() => {
    if (hasHandled.current) return;
    hasHandled.current = true;

    const search = window.location.search;
    if (!search) return;

    const params = new URLSearchParams(search);
    const code = params.get('authorization_code') ?? params.get('code');
    if (!code) return;

    // Clean the code from URL so refresh doesn't re-trigger
    const cleanUrl = window.location.href.split('?')[0] + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);

    const setToken = useSymposiumStore.getState().setZhihuAccessToken;
    const setUser = useSymposiumStore.getState().setZhihuUser;

    exchangeCodeForToken(code)
      .then((data) => {
        setToken(data.access_token);
        return fetchZhihuUser(data.access_token);
      })
      .then((user) => {
        setUser(user);
        console.log('[OAuth] 登录成功', user.fullname);
      })
      .catch((err) => {
        console.error('[OAuth] 登录失败:', err);
      });
  }, []);

  return null;
}

export default function App() {
  return (
    <HashRouter>
      <OAuthHandler />
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </HashRouter>
  );
}
