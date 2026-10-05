-- Keep PostgREST aware of live RPCs after live-score schema updates.
notify pgrst, 'reload schema';
