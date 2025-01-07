using ClippitWinforms.AgentCore;
using ClippitWinforms.AgentCore.Models;
using ClippitWinforms.AgentCore.Services;
using System.Globalization;

namespace ClippitWinforms.Managers;

public class Agent : IDisposable
{
    private AnimationManager animationManager;
    private AudioManager audioManager;
    private StateManager stateManager;
    private BalloonView speechBalloon;
    
    private AgentCharacterDefinition characterDefinition;
    private Info currentInfo;

    public event EventHandler? FrameChanged;
    public event EventHandler<string>? AnimationCompleted;

    public Agent(Form parentForm, string spritePath, string animationJsonPath,
        string soundsJsonPath, string agentPath)
    {
        InitializeManagers(spritePath, animationJsonPath, soundsJsonPath, agentPath);

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


    }

    public AgentCharacterDefinition ReadFile(string path)
    {
        CharacterParser parser = new CharacterParser();
        return parser.ParseFromFile(path);
    }

    private void InitializeManagers(string spritePath, string animationJsonPath,
        string soundsJsonPath, string agentPath)
    {
        characterDefinition = ReadFile(agentPath);

        // Create sprite manager with transparency key
        var spriteManager = new BitmapSpriteManager(
            spritePath,
            characterDefinition.Character.Width, // sprite width
            characterDefinition.Character.Height,  // sprite height
            Color.FromArgb(255, 0, 255) // transparency key
        );

        animationManager = new AnimationManager(spriteManager, animationJsonPath);
        audioManager = new AudioManager(soundsJsonPath);

        animationManager.FrameChanged += (s, e) =>
        {
            var currentFrame = animationManager.GetCurrentFrame();
            if (currentFrame?.Sound != null)
            {
                audioManager.PlayFrameSound(currentFrame.Sound);
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
        await stateManager.PlayAnimationOnce(animationName, timeoutMs);
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