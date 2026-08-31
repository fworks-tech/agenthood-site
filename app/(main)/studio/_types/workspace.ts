// #TODO Workspaces: types per docs/hackathon/spec.md:189-203,164-177,254-266
// - WorkspaceSpec { memberIds, instruction }, WorkspaceTurn, WorkspaceEvent (workspace.* vocabulary)
// - reuse Provider types from ./studio.ts where needed

export type WorkspaceSpec = {
  memberIds: string[]
  instruction: string
}

// #TODO add WorkspaceTurn, WorkspaceEvent, WorkspaceStatus unions
