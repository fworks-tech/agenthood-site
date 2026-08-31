// #TODO Workspaces: core turn scheduler per docs/hackathon/spec.md:85-142, HACKATHON-PLAN.md:188-205
// - state machine: MEDIATOR_TURN (JSON {members:[{id,task,order}]}) -> MEMBER_TURN -> MEMBER_RESULT
// - shared thread: full thread trimmed by max token budget (not LLM summary)
// - stop: all-pass / budget 10 / AbortSignal (user pause+Mediator re-plan) / workspace.handoff (code_execution)
// - emits workspace.* events, mirrors {type:log} for LiveLogs

export type WorkspaceTurn = { memberId: string; turnIndex: number }

// #TODO implement scheduler + budget + trimming + handoff
