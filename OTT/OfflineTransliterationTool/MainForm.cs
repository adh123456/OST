using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace OfflineTransliterationTool
{
    public class MainForm : Form
    {
        private WebView2 webView = null!;
        private const string VirtualOrigin = "https://app.local";
        private readonly Dictionary<string, string> resourceLookup = new(StringComparer.OrdinalIgnoreCase);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool DestroyIcon(IntPtr hIcon);

        public MainForm()
        {
            Text = "Offline Transliteration Tool";
            WindowState = FormWindowState.Maximized;
            MinimumSize = new Size(900, 620);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = ColorTranslator.FromHtml("#F5F2EB");
            Icon = CreateCustomAppIcon();

            BuildResourceLookup();
            InitializeWebViewControl();
        }

        private void BuildResourceLookup()
        {
            Assembly assembly = Assembly.GetExecutingAssembly();
            foreach (string resName in assembly.GetManifestResourceNames())
            {
                resourceLookup[resName] = resName;
            }
        }

        private void InitializeWebViewControl()
        {
            webView = new WebView2
            {
                Dock = DockStyle.Fill,
                DefaultBackgroundColor = ColorTranslator.FromHtml("#F5F2EB")
            };
            Controls.Add(webView);
            Load += async (s, e) => await InitializeWebViewAsync();
        }

        private async System.Threading.Tasks.Task InitializeWebViewAsync()
        {
            string userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "OfflineTransliterationTool");

            var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
            await webView.EnsureCoreWebView2Async(env);

            var settings = webView.CoreWebView2.Settings;
            settings.AreDefaultContextMenusEnabled = true;
            settings.AreDevToolsEnabled = false;
            // Enabled so Ctrl+F (Find on Page) works; unwanted keys (F5, Ctrl+R, Ctrl+P) are blocked in JS
            settings.AreBrowserAcceleratorKeysEnabled = true;
            settings.IsStatusBarEnabled = false;
            settings.IsZoomControlEnabled = false;

            webView.CoreWebView2.AddWebResourceRequestedFilter(
                $"{VirtualOrigin}/*", CoreWebView2WebResourceContext.All);
            webView.CoreWebView2.WebResourceRequested += OnWebResourceRequested;

            webView.CoreWebView2.Navigate($"{VirtualOrigin}/index.html");
        }

        private void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
        {
            if (!Uri.TryCreate(e.Request.Uri, UriKind.Absolute, out Uri? uri))
            {
                e.Response = webView.CoreWebView2.Environment.CreateWebResourceResponse(
                    null, 400, "Bad Request", "");
                return;
            }

            string relativePath = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/'));
            if (string.IsNullOrEmpty(relativePath)) relativePath = "index.html";

            Stream? stream = TryOpenManifestResource(relativePath);

            if (stream != null)
            {
                string contentType = GetMimeType(relativePath);
                string headers = contentType.StartsWith("text/") || contentType == "application/javascript" || contentType == "application/json"
                    ? $"Content-Type: {contentType}; charset=utf-8"
                    : $"Content-Type: {contentType}";

                e.Response = webView.CoreWebView2.Environment.CreateWebResourceResponse(
                    stream, 200, "OK", headers);
            }
            else
            {
                e.Response = webView.CoreWebView2.Environment.CreateWebResourceResponse(
                    null, 404, "Not Found", "");
            }
        }

        private Stream? TryOpenManifestResource(string relativePath)
        {
            Assembly assembly = Assembly.GetExecutingAssembly();

            // Standard dot-separated path
            string candidate1 = $"OfflineTransliterationTool.wwwroot.{relativePath.Replace('/', '.')}";
            if (resourceLookup.TryGetValue(candidate1, out string? actual1))
            {
                return assembly.GetManifestResourceStream(actual1);
            }

            // MSBuild converts hyphens in directory segments to underscores in manifest resource names
            string[] segments = relativePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length > 1)
            {
                for (int i = 0; i < segments.Length - 1; i++)
                {
                    segments[i] = segments[i].Replace('-', '_');
                }
                string candidate2 = $"OfflineTransliterationTool.wwwroot.{string.Join('.', segments)}";
                if (resourceLookup.TryGetValue(candidate2, out string? actual2))
                {
                    return assembly.GetManifestResourceStream(actual2);
                }
            }

            return null;
        }

        private static string GetMimeType(string path)
        {
            return Path.GetExtension(path).ToLowerInvariant() switch
            {
                ".html"  => "text/html",
                ".css"   => "text/css",
                ".js"    => "application/javascript",
                ".json"  => "application/json",
                ".svg"   => "image/svg+xml",
                ".png"   => "image/png",
                ".jpg"   => "image/jpeg",
                ".jpeg"  => "image/jpeg",
                ".gif"   => "image/gif",
                ".ico"   => "image/x-icon",
                ".woff"  => "font/woff",
                ".woff2" => "font/woff2",
                ".ttf"   => "font/ttf",
                ".otf"   => "font/otf",
                _        => "application/octet-stream"
            };
        }

        private static Icon CreateCustomAppIcon()
        {
            using Bitmap bmp = new Bitmap(64, 64);
            using Graphics g = Graphics.FromImage(bmp);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;

            using (SolidBrush bgBrush = new SolidBrush(ColorTranslator.FromHtml("#261710")))
            {
                g.FillEllipse(bgBrush, 2, 2, 60, 60);
            }
            using (Pen borderPen = new Pen(ColorTranslator.FromHtml("#D4AF37"), 3))
            {
                g.DrawEllipse(borderPen, 3, 3, 58, 58);
            }
            using (Font font = new Font("Nirmala UI", 30, FontStyle.Bold, GraphicsUnit.Pixel))
            using (SolidBrush textBrush = new SolidBrush(Color.White))
            using (StringFormat sf = new StringFormat
            {
                Alignment = StringAlignment.Center,
                LineAlignment = StringAlignment.Center
            })
            {
                g.DrawString("\u0905", font, textBrush, new RectangleF(0, 2, 64, 64), sf);
            }

            IntPtr hIcon = bmp.GetHicon();
            try
            {
                using Icon tempIcon = Icon.FromHandle(hIcon);
                return (Icon)tempIcon.Clone();
            }
            finally
            {
                DestroyIcon(hIcon);
            }
        }
    }
}