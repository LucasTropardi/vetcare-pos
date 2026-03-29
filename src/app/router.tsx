import { createBrowserRouter } from "react-router-dom";
import { RequireAuth } from "./RequireAuth";
import { AppLayout } from "../layouts/AppLayout/AppLayout";
import { AuthLayout } from "../layouts/AuthLayout/AuthLayout";
import { HomePage } from "../pages/Home/HomePage";
import { LoginPage } from "../pages/Login/LoginPage";
import { PaymentPage } from "../pages/Payment/PaymentPage";
import { SalesPage } from "../pages/Sales/SalesPage";
import { AppointmentsPage } from "../pages/Appointments/AppointmentsPage";
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
      { path: "/pagamento", element: <PaymentPage /> },
      { path: "/vendas", element: <SalesPage /> },
      { path: "/atendimentos", element: <AppointmentsPage /> },
      { path: "/tutores", element: <PlaceholderPage title="Tutores" /> },
      { path: "/empresas", element: <PlaceholderPage title="Empresas" /> },
    ],
  },
]);
