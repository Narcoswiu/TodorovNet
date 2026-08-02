using Microsoft.AspNetCore.SignalR;

namespace TodorovNET.API.Hubs;

public class RaceHub : Hub
{
    public async Task JoinEvent(int eventId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"event-{eventId}");
    }

    public async Task LeaveEvent(int eventId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"event-{eventId}");
    }
}
