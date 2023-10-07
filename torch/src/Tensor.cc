#include "Tensor.h"
#include <torch/torch.h>
#include <exception>
#include "utils.h"

namespace nodeml_torch
{
    using namespace Napi;

    Napi::FunctionReference Tensor::constructor;

    Napi::Object Tensor::Init(Napi::Env env, Napi::Object exports)
    {
        auto func = DefineClass(env, "Tensor", {Tensor::InstanceMethod("toArray", &Tensor::ToArray), Tensor::InstanceMethod("shape", &Tensor::Shape), Tensor::InstanceMethod("view", &Tensor::View)});

        constructor = Napi::Persistent(func);
        constructor.SuppressDestruct();
        exports.Set("Tensor", func);
        return exports;
    }

    Tensor::Tensor(const Napi::CallbackInfo &info) : ObjectWrap(info)
    {
        auto env = info.Env();
        std::vector<float> data;
        std::vector<std::int64_t> shape;

        try
        {
            if (info.Length() > 0 && info[0].IsArray())
            {
                data = NapiArrayToVector<float>(info[0].As<Napi::Array>());

                if (info.Length() > 1 && info[1].IsArray())
                {
                    shape = NapiArrayToVector<std::int64_t>(info[1].As<Napi::Array>());

                    // for (int i = 0; i < dims.Length(); i++)
                    // {
                    //     shape.push_back(dims.Get(i).As<Napi::Number>().Int64Value());
                    // }
                }
            }

            if (data.size() == 0)
            {
                return;
            }

            if (shape.size() == 0)
            {
                shape.push_back(data.size());
            }

            tensor = torch::from_blob((float *)(data.data()), data.size()).view(shape);
        }
        catch (const std::exception &e)
        {
            throw Napi::Error::New(env, e.what());
        }
    }

    Napi::Object Tensor::FromTorchTensor(const Napi::CallbackInfo &info, torch::Tensor torchTensor)
    {
        auto env = info.Env();
        try
        {
            Napi::EscapableHandleScope scope(env);
            auto newTensor = Tensor::constructor.New({});
            Napi::ObjectWrap<Tensor>::Unwrap(newTensor)->tensor = torchTensor;
            return scope.Escape(newTensor).ToObject();
        }
        catch (const std::exception &e)
        {
            throw Napi::Error::New(env, e.what());
        }

        return Napi::Object();
    }

    Napi::Value Tensor::Shape(const Napi::CallbackInfo &info)
    {
        auto env = info.Env();
        auto shape = tensor.sizes();
        auto nodeReturn = Napi::Array::New(env, shape.size());
        int idx = 0;
        for (auto dim : shape)
        {
            nodeReturn.Set(idx, dim);
            idx++;
        }

        return nodeReturn;
    }

    Napi::Value Tensor::ToArray(const Napi::CallbackInfo &info)
    {

        auto env = info.Env();

        auto flattened = tensor.view({-1});

        std::int64_t totalItems = flattened.sizes()[0];

        auto nodeReturn = Napi::Array::New(env, totalItems);

        auto dtype = flattened.dtype().name();

        auto items = flattened.data<int64_t>();

        for (std::int64_t i = 0; i < totalItems; i++)
        {
            nodeReturn.Set(i, items[i]);
        }

        return nodeReturn;
    }

    Napi::Value Tensor::View(const Napi::CallbackInfo &info)
    {
        auto env = info.Env();

        if (info.Length() > 0 && info[0].IsArray())
        {
            return FromTorchTensor(info, tensor.view(NapiArrayToVector<int64_t>(info[0].As<Array>())));
        }
        else
        {
            throw Napi::Error::New(env, "Why have you done this ?");
        }
        return Napi::Object();
    }
}
