/* eslint-disable import/no-named-as-default */
import { configureStore } from "@reduxjs/toolkit";
import MainSlice from "./slices/main";
export const store = configureStore({
  reducer: {
    main: MainSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;



