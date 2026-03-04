import { createBrowserRouter } from "react-router-dom";
import { RequireAuth } from "./RequireAuth";
import { AppLayout } from "../layouts/AppLayout/AppLayout";
import { AuthLayout } from "../layouts/AuthLayout/AuthLayout";
import { HomePage } from "../pages/Home/HomePage";
import { LoginPage } from "../pages/Login/LoginPage";
import { PlaceholderPage } from "../pages/Placeholder/PlaceholderPage";

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [{ path: "/login", element: <LoginPage /> }],
  },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/pagamento", element: <PlaceholderPage title="Pagamento" /> },
      { path: "/vendas", element: <PlaceholderPage title="Vendas" /> },
      { path: "/atendimentos", element: <PlaceholderPage title="Atendimentos" /> },
      { path: "/tutores", element: <PlaceholderPage title="Tutores" /> },
      { path: "/empresas", element: <PlaceholderPage title="Empresas" /> },
    ],
  },
]);
