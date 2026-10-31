// Counts Emerald Arcade request attempts, not provider tokens, charges or model invocations.
export function beginNotification(delivery,message,{format='compact-v1',kind='turn',retry=false,repair=false,needsAction=false}={}){
 const totals={attempts:0,characters:0,transportRetries:0,repairAttempts:0,completedActionRequests:0,unactedReplies:0,partialReplies:0,failedRequests:0,...delivery.notificationTotals},characters=Array.from(message).length;
 totals.attempts++;totals.characters+=characters;if(retry)totals.transportRetries++;if(repair)totals.repairAttempts++;
 return {notificationMetrics:{format,characters,kind,retry,repair,needsAction,outcome:'pending'},notificationTotals:totals};
}
export function completeNotification(delivery,outcome){
 const metrics=delivery.notificationMetrics;if(!metrics||metrics.outcome!=='pending')return {};
 const totals={...delivery.notificationTotals};const key={completed:'completedActionRequests',unacted:'unactedReplies',partial:'partialReplies',error:'failedRequests'}[outcome];if(key)totals[key]=(totals[key]||0)+1;
 return {notificationMetrics:{...metrics,outcome},notificationTotals:totals};
}
