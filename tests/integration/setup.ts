import "../support/load-env"

import { assertDevProject } from "../support/supabase"

// Fail fast, before any test creates users, if the env points anywhere but the dev project.
assertDevProject()
