using System.Drawing.Imaging;
using System.Text.Json;

namespace ClippitWinforms
{
    public partial class Clippy : Form
    {
        private Bitmap spriteSheet;
        const int scale = 2;
        const int frameWidth = 124;
        const int frameHeight = 93;
        const int framesPerRow = 27;
        const int totalRows = 34;
        private int currentFrame = 0;
        private int currentRow = 0;

        private int currentFrameIndex = 0;
        private long lastFrameTime;
        private Dictionary<string, Animation> animations;
        private Animation currentAnimation;

        public Clippy()
        {
            InitializeComponent();
            this.StartPosition = FormStartPosition.Manual; // Set to manual
            Rectangle workingArea = Screen.GetWorkingArea(this);
            this.Location = new Point(workingArea.Right - this.Width, workingArea.Bottom - this.Height);
            LoadSprites();

            LoadAnimations();
            SetAnimation("Congratulate");  // Set default animation
            lastFrameTime = Environment.TickCount64;
            animationTimer.Start();
        }

        private void exitToolStripMenuItem_Click(object sender, EventArgs e)
        {
            Application.Exit();
        }

        private void trayIcon_MouseDoubleClick(object sender, MouseEventArgs e)
        {
            if (Visible) Hide();
            else Show();
        }

        private void LoadSprites()
        {
            string spritePath = @"D:\Exercises\ClippitWinforms\ClippitWinforms\map.png";
            try
            {
                using (Bitmap originalImage = new(spritePath))
                {
                    spriteSheet = new Bitmap(originalImage.Width, originalImage.Height, PixelFormat.Format32bppArgb);

                    using (Graphics g = Graphics.FromImage(spriteSheet))
                    {
                        ImageAttributes imageAttributes = new();
                        imageAttributes.SetColorKey(Color.FromArgb(255, 0, 255), Color.FromArgb(255, 0, 255));

                        g.DrawImage(originalImage,
                            new Rectangle(0, 0, originalImage.Width, originalImage.Height),
                            0, 0, originalImage.Width, originalImage.Height,
                            GraphicsUnit.Pixel,
                            imageAttributes);
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error loading sprite sheet: {ex.Message}\nTried to load from: {spritePath}",
                    "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void LoadAnimations()
        {
            animations = new Dictionary<string, Animation>();
            string animationsJson = @"{
                ""Congratulate"": {
                  ""frames"": [
                    {
                      ""duration"": 100,
                      ""images"": [
                        [
                          0,
                          0
                        ]
                      ],
                      ""sound"": ""15""
                    },
                    {
                      ""duration"": 10,
                      ""images"": [
                        [
                          124,
                          0
                        ]
                      ]
                    },
                    {
                      ""duration"": 10,
                      ""images"": [
                        [
                          248,
                          0
                        ]
                      ]
                    },
                    {
                      ""duration"": 10,
                      ""images"": [
                        [
                          372,
                          0
                        ]
                      ],
                      ""sound"": ""14""
                    },
                    {
                      ""duration"": 10,
                      ""images"": [
                        [
                          496,
                          0
                        ]
                      ]
                    },
                    {
                      ""duration"": 10,
                      ""images"": [
                        [
                          620,
                          0
                        ]
                      ]
                    },
                    {
                      ""duration"": 10,
                      ""images"": [
                        [
                          744,
                          0
                        ]
                      ]
                    },
                    {
                      ""duration"": 10,
                      ""images"": [
                        [
                          868,
                          0
                        ]
                      ]
                    },
                    {
                      ""duration"": 10,
                      ""images"": [
                        [
                          992,
                          0
                        ]
                      ],
                      ""sound"": ""1""
                    },
                    {
                      ""duration"": 100,
                      ""images"": [
                        [
                          1116,
                          0
                        ]
                      ]
                    },
                    {
                      ""duration"": 100,
                      ""images"": [
                        [
                          1240,
                          0
                        ]
                      ]
                    },
                    {
                      ""duration"": 100,
                      ""images"": [
                        [
                          1364,
                          0
                        ]
                      ]
                    },
                    {
                      ""duration"": 1200,
                      ""images"": [
                        [
                          1488,
                          0
                        ]
                      ]
                    },
                    {
                      ""duration"": 100,
                      ""images"": [
                        [
                          1612,
                          0
                        ]
                      ],
                      ""sound"": ""10""
                    },
                    {
                      ""duration"": 100,
                      ""images"": [
                        [
                          1736,
                          0
                        ]
                      ]
                    },
                    {
                      ""duration"": 1200,
                      ""images"": [
                        [
                          1488,
                          0
                        ]
                      ]
                    },
                    {
                      ""duration"": 100,
                      ""images"": [
                        [
                          1860,
                          0
                        ]
                      ]
                    },
                    {
                      ""duration"": 100,
                      ""images"": [
                        [
                          1984,
                          0
                        ]
                      ]
                    },
                    {
                      ""duration"": 100,
                      ""images"": [
                        [
                          2108,
                          0
                        ]
                      ]
                    },
                    {
                      ""duration"": 100,
                      ""images"": [
                        [
                          2232,
                          0
                        ]
                      ]
                    },
                    {
                      ""duration"": 100,
                      ""images"": [
                        [
                          2356,
                          0
                        ]
                      ],
                      ""exitBranch"": 21
                    },
                    {
                      ""duration"": 100,
                      ""images"": [
                        [
                          0,
                          0
                        ]
                      ]
                    }
                  ]
                }
            }";

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            var animationsDict = JsonSerializer.Deserialize<Dictionary<string, Animation>>(animationsJson, options);
            animations = animationsDict;
        }

        private void SetAnimation(string animationName)
        {
            if (animations.TryGetValue(animationName, out var animation))
            {
                currentAnimation = animation;
                currentFrameIndex = 0;
                lastFrameTime = Environment.TickCount64;
            }
        }

        private void animationTimer_Tick(object sender, EventArgs e)
        {
            if (currentAnimation == null || currentAnimation.Frames == null ||
                currentAnimation.Frames.Count == 0) return;

            var currentTime = Environment.TickCount64;
            var currentFrame = currentAnimation.Frames[currentFrameIndex];

            if (currentTime - lastFrameTime >= currentFrame.Duration)
            {
                currentFrameIndex = (currentFrameIndex + 1) % currentAnimation.Frames.Count;
                lastFrameTime = currentTime;
                this.Invalidate();
            }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);

            if (spriteSheet != null && currentAnimation?.Frames != null &&
                currentFrameIndex < currentAnimation.Frames.Count)
            {
                var frame = currentAnimation.Frames[currentFrameIndex];
                if (frame.Images != null && frame.Images.Count > 0)
                {
                    var position = frame.Images[0]; // Get first image position
                    int sourceX = position[0];
                    int sourceY = position[1];

                    Rectangle sourceRect = new Rectangle(sourceX, sourceY, frameWidth, frameHeight);

                    e.Graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
                    e.Graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.Half;

                    e.Graphics.DrawImage(
                        spriteSheet,
                        new Rectangle(0, 0, frameWidth * scale, frameHeight * scale),
                        sourceRect,
                        GraphicsUnit.Pixel
                    );

                    // Debug information
                    string debugText = $"Frame: {currentFrameIndex}, Position: [{sourceX}, {sourceY}]";
                    Font debugFont = new Font("Arial", 12, FontStyle.Bold);
                    e.Graphics.DrawString(
                        debugText,
                        debugFont,
                        Brushes.White,
                        new PointF(10, 10)
                    );
                }
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            base.OnFormClosing(e);
            trayIcon.Dispose();
            animationTimer?.Dispose();
            spriteSheet?.Dispose();
            // controlsForm?.Dispose();
        }
    }
}
