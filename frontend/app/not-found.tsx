import { NotFoundScreen } from "./components/NotFoundScreen";

/**
 * Served for any URL that matches no route in the app.
 *
 * The root `not-found` file has caught unmatched URLs app-wide since Next 13.3, and it renders
 * inside the root layout — which is what lets the screen below use the language provider like every
 * other page. (`global-not-found.js` exists for apps with several root layouts or a dynamic root
 * segment; this app has neither, and it would bypass the layout and the translations with it.)
 */
export default function NotFound() {
  return <NotFoundScreen />;
}
