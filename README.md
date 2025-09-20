# Threadweaver

My latest pet project: [Threadweaver](https://github.com/monsur/threadweaver)

I like to think of [my BlueSky](https://bsky.app/profile/monsur.hossa.in) as blog posts split into bite-sized chunks. Threadweaver helps compose these posts by giving visual feedback on chunk sizes.

Threadweaver is a single HTML page with a text box. As the user types, an indicator on the left numbers each BlueSky post. Clicking the indicator copies the post to the clipboard. The text turns red if it goes over the character limit.

![Screenshot of Threadweaver](https://monsur.hossa.in/images/posts/threadweaver01.png "Screenshot of Threadweaver")

Threadweaver was vibecoded, of course. Gemini built the first version and it worked well out of the box.

Things got complicated when adding a new feature: I wanted to copy each chunk by clicking the indicator on the right. Gemini kept trying but couldn't get it.

Claude didn't fare much better. While Claude had some neat ideas (like visual feedback to the user on click), the overall feature didn't work.

So I tried a different approach: breaking the problem into pieces and building up to the solution.

Claude fared much better on small iterative prompts in succession: change the cursor, add a click action, copy the text, etc.

This approach reduced the problem space to small simple chunks, each with clear scope.

Better problem framing guided AI to a better solution.

I don't know if this tool will be useful to anyone else, but that's exactly the point of vibecoding.

In about 30mins, I built a tool that helps my own personal workflow.

It would take many hours to build this tool from scratch, and vibecoding lowers that barrier to entry.

BTW this is my first post composed in Threadweaver! (And kudos to Gemini for suggesting the name!)

This README mirrored from https://monsur.hossa.in/blog/2025/09/20/my-latest-pet-project-threadw/
