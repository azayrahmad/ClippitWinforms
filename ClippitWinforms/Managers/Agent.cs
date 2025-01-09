using ClippitWinforms.AgentCore;
using ClippitWinforms.AgentCore.Models;
using ClippitWinforms.AgentCore.Services;
using System.Globalization;

namespace ClippitWinforms.Managers;

public class Agent : IDisposable
{
    private AnimationManager animationManager;
    private IAudioManager audioManager;
    private StateManager stateManager;
    private BalloonView speechBalloon;
    
    private AgentCharacterDefinition characterDefinition;
    private Info currentInfo;

    public Color TransparencyKey {  get; set; }
    public event EventHandler? FrameChanged;
    public event EventHandler<string>? AnimationCompleted;

    private string agentFolderPath;

    public Agent(Form parentForm, string agentPath)
    {
        InitializeManagers(agentPath);
        parentForm.BackColor = TransparencyKey;
        parentForm.TransparencyKey = TransparencyKey;

        // Create the speech balloon
        speechBalloon = new BalloonView(parentForm);

        var info = characterDefinition.Character.Infos.FirstOrDefault(info => info.LanguageCode.Equals(CultureInfo.CurrentCulture));
        if (info != null)
        {
            currentInfo = info;
        }
        else
        {
            currentInfo = characterDefinition.Character.Infos.First(info => info.LanguageCode.Equals(CultureInfo.GetCultureInfo(0x0009)));
        }

        parentForm.Name = currentInfo.Name;
    }

    public AgentCharacterDefinition ReadFile(string path)
    {
        CharacterParser parser = new CharacterParser();
        return parser.ParseFromFile(path);
    }

    private void InitializeManagers(string agentPath)
    {
        characterDefinition = ReadFile(agentPath);

        agentFolderPath = Path.GetDirectoryName(agentPath);

        var dirSpriteManager = new DirectorySpriteManager(Path.Combine(agentFolderPath, "Images"), characterDefinition.Character);
        TransparencyKey = dirSpriteManager.TransparencyKey;
        animationManager = new AnimationManager(dirSpriteManager, characterDefinition.Animations);
        audioManager = new WavDirectoryAudioManager(Path.Combine(agentFolderPath, "Audio"));

        animationManager.FrameChanged += (s, e) =>
        {
            var currentFrame = animationManager.GetCurrentFrame();
            if (currentFrame?.SoundEffect != null)
            {
                audioManager.PlayFrameSound(currentFrame.SoundEffect);
            }
            FrameChanged?.Invoke(this, EventArgs.Empty);
        };

        animationManager.AnimationCompleted += async (s, animName) =>
        {
            AnimationCompleted?.Invoke(this, animName);
            await HandleAnimationCompleted();
        };

        stateManager = new StateManager(characterDefinition.States, animationManager);
    }

    public IEnumerable<string> GetSelectableAnimations()
    {
        return animationManager.GetSelectableAnimations().OrderBy(a => a);
    }

    public IEnumerable<string> GetAvailableStates()
    {
        return stateManager.GetAvailableStates();
    }

    public async Task Start()
    {
        stateManager.SetState("Playing");
        await animationManager.InterruptAndPlayAnimation("Greeting");
        speechBalloon.ShowBalloon(
            currentInfo.Name,
            currentInfo.Greetings[new Random().Next(currentInfo.Greetings.Count) - 1],
            10000);
        await stateManager.SetState("IdlingLevel1");
    }

    public async Task PlayClosingAnimation()
    {
        await animationManager.InterruptAndPlayAnimation("GoodBye");
    }

    public async Task PlayAnimation(string animationName, int? timeoutMs = null)
    {
        await stateManager.PlayAnimation(animationName, timeoutMs);
    }

    public async Task PlayAnimationLoop(string animationName)
    {
        await animationManager.InterruptAndPlayAnimation(animationName);
    }

    public async Task SetState(string state)
    {
        await stateManager.SetState(state);
    }

    public async Task PlayRandomAnimation()
    {
        await stateManager.PlayRandomAnimation();
    }

    private async Task HandleAnimationCompleted()
    {
        await stateManager.HandleAnimationCompleted();
    }

    public async Task HandleVisibilityChange(bool isVisible)
    {
        await stateManager.HandleVisibilityChange(isVisible);
        if (!isVisible)
        {
            speechBalloon.HideBalloon();
        }
    }

    public void DrawCurrentFrame(Graphics graphics)
    {
        animationManager.DrawCurrentFrame(graphics);
    }

    public string GetCurrentState()
    {
        return stateManager.GetCurrentState();
    }

    public string GetCurrentAnimationName()
    {
        return animationManager.CurrentAnimation.Name;
    }

    public int GetCurrentFrameIndex()
    {
        return animationManager.CurrentFrameIndex;
    }

    public void Dispose()
    {
        audioManager.Dispose();
        animationManager.Dispose();
        stateManager.Dispose();
    }
}