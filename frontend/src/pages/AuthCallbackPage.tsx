import { LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { githubCallbackUrl } from '../api/client';
import { useAuthStore } from '../store/authStore';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore(state => state.setToken);

  useEffect(() => {
    console.log('========== AUTH CALLBACK ==========');
    console.log('FULL URL:', window.location.href);
    console.log('HASH:', window.location.hash);
    console.log('SEARCH:', window.location.search);

    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const searchParams = new URLSearchParams(window.location.search);

    const token = getTokenFromCallbackUrl(hashParams, searchParams);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    console.log('TOKEN FOUND:', Boolean(token));

    try {
      if (token) {
        console.log('Saving token...');
        setToken(token);

        console.log('Token saved successfully');
        console.log('Redirecting to dashboard...');

        window.location.replace('/');
      } else if (code && state) {
        console.log('OAuth code reached frontend; forwarding to backend callback...');
        window.location.assign(githubCallbackUrl(window.location.search));
      } else {
        console.error('NO TOKEN FOUND IN URL');

        navigate(
          '/login?message=Authentication%20could%20not%20be%20completed.',
          { replace: true }
        );
      }
    } catch (error) {
      console.error('AUTH CALLBACK ERROR:', error);

      navigate(
        '/login?message=Authentication%20callback%20failed.',
        { replace: true }
      );
    }
  }, [navigate, setToken]);

  return (
    <div className="grid min-h-screen place-items-center bg-ink text-white">
      <div className="text-center">
        <LoaderCircle className="mx-auto animate-spin text-signal" />
        <p className="mt-4 text-sm text-stone-400">
          Opening your workspace…
        </p>
      </div>
    </div>
  );
}

function getTokenFromCallbackUrl(
  hashParams: URLSearchParams,
  searchParams: URLSearchParams,
) {
  const parsedToken = hashParams.get('token') || searchParams.get('token');
  if (parsedToken) return parsedToken;

  const rawHash = window.location.hash.replace(/^#/, '');
  if (!rawHash.startsWith('token=')) return null;

  return decodeURIComponent(rawHash.slice('token='.length));
}
