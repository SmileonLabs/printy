import type { StateCreator } from "zustand";
import { normalizeContact } from "@/lib/contact";
import type { LocalUser } from "@/lib/types";
import { makeId } from "@/store/printy-store-id-date";
import type { PrintyState } from "@/store/printy-store-types";

type PrintyStoreSet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[0];
type PrintyStoreGet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[1];

type PrintySessionActions = Pick<PrintyState, "login" | "logout" | "enterDashboard">;

export function createPrintySessionActions(set: PrintyStoreSet, get: PrintyStoreGet): PrintySessionActions {
  return {
    login: (input, redirectTarget = "dashboard") => {
      const name = input.name.trim();
      const contact = input.id ? input.contact.trim().toLowerCase() : normalizeContact(input.contact);

      if (!name || !contact) {
        return;
      }

      set((state) => {
        const now = input.authenticatedAt ?? new Date().toISOString();
        const existingUser = state.users.find((user) => user.contact === contact);
        const nextUser: LocalUser = existingUser
          ? {
              ...existingUser,
              id: input.id ?? existingUser.id,
              name: existingUser.name !== name ? name : existingUser.name,
              updatedAt: existingUser.name !== name ? now : existingUser.updatedAt,
            }
          : {
              id: input.id ?? makeId("user", state.users.length),
              name,
              contact,
              createdAt: now,
              updatedAt: now,
            };

        const authenticatedState = {
          isAuthenticated: true,
          users: [nextUser, ...state.users.filter((user) => user.id !== nextUser.id && user.contact !== nextUser.contact)],
          authSession: {
            userId: nextUser.id,
            name: nextUser.name,
            contact: nextUser.contact,
            authenticatedAt: now,
          },
        };

        if (redirectTarget === "dashboard") {
          return {
            ...authenticatedState,
            onboardingComplete: true,
            activeTab: "home",
            brandView: "list",
            activeBrandSection: "style",
            currentStep: "home",
            loginRedirectTarget: undefined,
            loginBackStep: undefined,
          };
        }

        return {
          ...authenticatedState,
          onboardingComplete: false,
          currentStep: "checkout",
          loginRedirectTarget: undefined,
          loginBackStep: undefined,
        };
      });
    },
    logout: () =>
      set({
        isAuthenticated: false,
        authSession: undefined,
        onboardingComplete: false,
        currentStep: "home",
        loginBackStep: undefined,
        activeTab: "home",
        brandView: "list",
      }),
    enterDashboard: () => {
      const state = get();

      if (!state.isAuthenticated || !state.authSession) {
        set({ onboardingComplete: false, currentStep: "home", activeTab: "home", brandView: "list" });
        return;
      }

      set({
        onboardingComplete: true,
        activeTab: "home",
        brandView: "list",
        activeBrandSection: "style",
      });
    },
  };
}
